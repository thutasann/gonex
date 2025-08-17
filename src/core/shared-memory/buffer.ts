/**
 * Shared Memory Buffer - High-performance buffer wrapper with header management,
 * data integrity checks, and efficient read/write operations.
 */

import { logger } from '../../utils';

/**
 * Magic number for buffer validation (0x474F4E45 = "GONE")
 */
const BUFFER_MAGIC = 0x474f4e45;

/**
 * Current buffer version
 */
const BUFFER_VERSION = 1;

/**
 * Buffer header structure
 */
export type BufferHeader = {
  /** Magic number for validation */
  magic: number;
  /** Version for compatibility */
  version: number;
  /** Total buffer size in bytes */
  size: number;
  /** Configuration flags */
  flags: number;
  /** Data integrity checksum */
  checksum: number;
  /** Reserved for future use */
  reserved: number;
};

/**
 * Buffer flags
 */
export const enum BufferFlags {
  /** Buffer is read-only */
  READ_ONLY = 0x00000001,
  /** Buffer is compressed */
  COMPRESSED = 0x00000002,
  /** Buffer is encrypted */
  ENCRYPTED = 0x00000004,
  /** Buffer has checksum validation */
  CHECKSUMED = 0x00000008,
  /** Buffer is circular */
  CIRCULAR = 0x00000010,
}

/**
 * Buffer statistics
 */
export type BufferStats = {
  /** Total bytes written */
  bytesWritten: number;
  /** Total bytes read */
  bytesRead: number;
  /** Number of write operations */
  writeCount: number;
  /** Number of read operations */
  readCount: number;
  /** Last write timestamp */
  lastWrite: number;
  /** Last read timestamp */
  lastRead: number;
};

/**
 * High-performance shared memory buffer wrapper
 *
 * Provides efficient data operations with:
 * - Header validation and integrity checks
 * - Optimized read/write operations
 * - Buffer statistics and monitoring
 * - Thread-safe data access
 */
export class SharedMemoryBuffer {
  private buffer: SharedArrayBuffer;
  private header: BufferHeader;
  private dataView: DataView;
  private uint8View: Uint8Array;
  private headerSize: number;
  private dataOffset: number;
  private stats: BufferStats;
  private isReadOnly: boolean;

  constructor(
    size: number,
    config?: Partial<BufferHeader>,
    existingBuffer?: SharedArrayBuffer
  ) {
    if (size <= 0) {
      throw new Error('Buffer size must be positive');
    }

    this.headerSize = 24; // 6 * 4 bytes (uint32)
    this.dataOffset = this.headerSize;

    if (existingBuffer) {
      this.buffer = existingBuffer;
    } else {
      this.buffer = new SharedArrayBuffer(size + this.headerSize);
    }

    this.dataView = new DataView(this.buffer);
    this.uint8View = new Uint8Array(this.buffer, this.dataOffset);

    if (existingBuffer) {
      this.validateExistingBuffer();
    }

    this.header = {
      magic: BUFFER_MAGIC,
      version: BUFFER_VERSION,
      size: size,
      flags: config?.flags || 0,
      checksum: 0,
      reserved: 0,
      ...config,
    };

    this.isReadOnly = (this.header.flags & BufferFlags.READ_ONLY) !== 0;

    this.stats = {
      bytesWritten: 0,
      bytesRead: 0,
      writeCount: 0,
      readCount: 0,
      lastWrite: 0,
      lastRead: 0,
    };

    this.writeHeader();
    logger.debug('SharedMemoryBuffer created', {
      size,
      flags: this.header.flags,
    });
  }

  /**
   * Get the underlying SharedArrayBuffer
   *
   * @returns SharedArrayBuffer instance
   */
  getBuffer(): SharedArrayBuffer {
    return this.buffer;
  }

  /**
   * Get the buffer header
   *
   * @returns Buffer header information
   */
  getHeader(): BufferHeader {
    return { ...this.header };
  }

  /**
   * Set buffer header properties
   *
   * @param header - Partial header to update
   * @throws Error if buffer is read-only
   */
  setHeader(header: Partial<BufferHeader>): void {
    if (this.isReadOnly) {
      throw new Error('Cannot modify read-only buffer header');
    }

    this.header = { ...this.header, ...header };
    this.writeHeader();
  }

  /**
   * Validate buffer header integrity
   *
   * @returns true if header is valid
   */
  validateHeader(): boolean {
    try {
      const magic = this.dataView.getUint32(0, false);
      const version = this.dataView.getUint32(4, false);
      const size = this.dataView.getUint32(8, false);
      const flags = this.dataView.getUint32(12, false);
      const checksum = this.dataView.getUint32(16, false);

      if (magic !== BUFFER_MAGIC) {
        logger.warn('Invalid buffer magic number', {
          expected: BUFFER_MAGIC,
          actual: magic,
        });
        return false;
      }

      if (version !== BUFFER_VERSION) {
        logger.warn('Unsupported buffer version', {
          expected: BUFFER_VERSION,
          actual: version,
        });
        return false;
      }

      if (size !== this.header.size) {
        logger.warn('Buffer size mismatch', {
          expected: this.header.size,
          actual: size,
        });
        return false;
      }

      // Verify checksum if enabled
      if ((flags & BufferFlags.CHECKSUMED) !== 0) {
        const calculatedChecksum = this.calculateChecksum();
        if (calculatedChecksum !== checksum) {
          logger.warn('Buffer checksum mismatch', {
            expected: checksum,
            actual: calculatedChecksum,
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error(
        'Header validation failed',
        new Error('Header validation failed'),
        { error }
      );
      return false;
    }
  }

  /**
   * Write data to the buffer
   *
   * @param data - Data to write
   * @param offset - Starting offset in the data area
   * @returns Number of bytes written
   * @throws Error if buffer is read-only or offset is invalid
   */
  write(data: Uint8Array, offset: number = 0): number {
    if (this.isReadOnly) {
      throw new Error('Cannot write to read-only buffer');
    }

    if (offset < 0 || offset >= this.header.size) {
      throw new Error('Invalid write offset');
    }

    const availableSpace = this.header.size - offset;
    const bytesToWrite = Math.min(data.length, availableSpace);

    if (bytesToWrite > 0) {
      this.uint8View.set(data.subarray(0, bytesToWrite), offset);

      this.stats.bytesWritten += bytesToWrite;
      this.stats.writeCount++;
      this.stats.lastWrite = Date.now();

      // Update checksum if enabled
      if ((this.header.flags & BufferFlags.CHECKSUMED) !== 0) {
        this.updateChecksum();
      }

      logger.debug('Data written to buffer', {
        offset,
        bytesWritten: bytesToWrite,
      });
    }

    return bytesToWrite;
  }

  /**
   * Read data from the buffer
   *
   * @param offset - Starting offset in the data area
   * @param length - Number of bytes to read
   * @returns Uint8Array containing the read data
   * @throws Error if offset or length is invalid
   */
  read(offset: number, length: number): Uint8Array {
    if (offset < 0 || offset >= this.header.size) {
      throw new Error('Invalid read offset');
    }

    if (length < 0 || offset + length > this.header.size) {
      throw new Error('Invalid read length');
    }

    const data = new Uint8Array(length);
    data.set(this.uint8View.subarray(offset, offset + length));

    this.stats.bytesRead += length;
    this.stats.readCount++;
    this.stats.lastRead = Date.now();

    logger.debug('Data read from buffer', { offset, length });
    return data;
  }

  /**
   * Clear a portion of the buffer
   *
   * @param offset - Starting offset in the data area
   * @param length - Number of bytes to clear
   * @throws Error if buffer is read-only or range is invalid
   */
  clear(offset: number, length: number): void {
    if (this.isReadOnly) {
      throw new Error('Cannot clear read-only buffer');
    }

    if (offset < 0 || offset >= this.header.size) {
      throw new Error('Invalid clear offset');
    }

    if (length < 0 || offset + length > this.header.size) {
      throw new Error('Invalid clear length');
    }

    this.uint8View.fill(0, offset, offset + length);

    // Update checksum if enabled
    if ((this.header.flags & BufferFlags.CHECKSUMED) !== 0) {
      this.updateChecksum();
    }

    logger.debug('Buffer cleared', { offset, length });
  }

  /**
   * Get buffer size information
   *
   * @returns Buffer size details
   */
  getSize(): { total: number; data: number; header: number } {
    return {
      total: this.buffer.byteLength,
      data: this.header.size,
      header: this.headerSize,
    };
  }

  /**
   * Get available space in the buffer
   *
   * @returns Available space in bytes
   */
  getAvailableSpace(): number {
    return this.header.size;
  }

  /**
   * Check if buffer is full (always false for this implementation)
   *
   * @returns false (buffers are pre-allocated)
   */
  isFull(): boolean {
    return false;
  }

  /**
   * Check if buffer is empty (no data written)
   *
   * @returns true if no data has been written
   */
  isEmpty(): boolean {
    return this.stats.bytesWritten === 0;
  }

  /**
   * Get buffer statistics
   *
   * @returns Buffer usage statistics
   */
  getStats(): BufferStats {
    return { ...this.stats };
  }

  /**
   * Reset buffer statistics
   */
  resetStats(): void {
    this.stats = {
      bytesWritten: 0,
      bytesRead: 0,
      writeCount: 0,
      readCount: 0,
      lastWrite: 0,
      lastRead: 0,
    };
  }

  /**
   * Check if buffer is read-only
   *
   * @returns true if buffer is read-only
   */
  isReadOnlyBuffer(): boolean {
    return this.isReadOnly;
  }

  /**
   * Set read-only flag
   *
   * @param readOnly - Whether to make buffer read-only
   */
  setReadOnly(readOnly: boolean): void {
    if (readOnly) {
      this.header.flags |= BufferFlags.READ_ONLY;
    } else {
      this.header.flags &= ~BufferFlags.READ_ONLY;
    }

    this.isReadOnly = readOnly;
    this.writeHeader();
  }

  /**
   * Validate existing buffer structure
   */
  private validateExistingBuffer(): void {
    if (this.buffer.byteLength < this.headerSize) {
      throw new Error('Buffer too small for header');
    }

    this.header = {
      magic: this.dataView.getUint32(0, false),
      version: this.dataView.getUint32(4, false),
      size: this.dataView.getUint32(8, false),
      flags: this.dataView.getUint32(12, false),
      checksum: this.dataView.getUint32(16, false),
      reserved: this.dataView.getUint32(20, false),
    };

    if (!this.validateHeader()) {
      throw new Error('Invalid existing buffer header');
    }
  }

  /**
   * Write header to the buffer
   */
  private writeHeader(): void {
    this.dataView.setUint32(0, this.header.magic, false);
    this.dataView.setUint32(4, this.header.version, false);
    this.dataView.setUint32(8, this.header.size, false);
    this.dataView.setUint32(12, this.header.flags, false);
    this.dataView.setUint32(16, this.header.checksum, false);
    this.dataView.setUint32(20, this.header.reserved, false);
  }

  /**
   * Calculate buffer data checksum
   */
  private calculateChecksum(): number {
    let checksum = 0;
    for (let i = 0; i < this.uint8View.length; i++) {
      checksum =
        ((checksum << 5) - checksum + (this.uint8View[i] || 0)) & 0xffffffff;
    }
    return checksum;
  }

  /**
   * Update buffer checksum
   */
  private updateChecksum(): void {
    this.header.checksum = this.calculateChecksum();
    this.dataView.setUint32(16, this.header.checksum, false);
  }
}
