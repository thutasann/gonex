#!/bin/bash

# Gonex Core Examples Runner
# Runs every single JavaScript file under core/ folders

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Statistics
TOTAL_FILES=0
PASSED_FILES=0
FAILED_FILES=0
SKIPPED_FILES=0
START_TIME=$(date +%s)

# Arrays to track results
PASSED_LIST=()
FAILED_LIST=()
SKIPPED_LIST=()

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "INFO")
            echo -e "${BLUE}ℹ️  ${message}${NC}"
            ;;
        "SUCCESS")
            echo -e "${GREEN}✅ ${message}${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  ${message}${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ ${message}${NC}"
            ;;
        "HEADER")
            echo -e "${PURPLE}📁 ${message}${NC}"
            ;;
        "SUBHEADER")
            echo -e "${CYAN}  📄 ${message}${NC}"
            ;;
    esac
}

# Function to calculate execution time
calculate_execution_time() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    
    if [ $minutes -gt 0 ]; then
        echo "${minutes}m ${seconds}s"
    else
        echo "${seconds}s"
    fi
}

# Function to print cool summary
print_summary() {
    local execution_time=$(calculate_execution_time)
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${WHITE}🎯 GONEX CORE EXAMPLES SUMMARY${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Success section
    if [ $PASSED_FILES -gt 0 ]; then
        echo -e "${GREEN}🎉 SUCCESSFUL EXECUTIONS (${PASSED_FILES})${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        for file in "${PASSED_LIST[@]}"; do
            echo -e "${GREEN}  ✅ ${file}${NC}"
        done
        echo ""
    fi
    
    # Failed section
    if [ $FAILED_FILES -gt 0 ]; then
        echo -e "${RED}💥 FAILED EXECUTIONS (${FAILED_FILES})${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        for file in "${FAILED_LIST[@]}"; do
            echo -e "${RED}  ❌ ${file}${NC}"
        done
        echo ""
    fi
    
    # Skipped section
    if [ $SKIPPED_FILES -gt 0 ]; then
        echo -e "${YELLOW}⏭️  SKIPPED FILES (${SKIPPED_FILES})${NC}"
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        for file in "${SKIPPED_LIST[@]}"; do
            echo -e "${YELLOW}  ⏭️  ${file}${NC}"
        done
        echo ""
    fi
    
    # Statistics
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${WHITE}📊 STATISTICS${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Calculate percentages
    local success_percent=0
    local failure_percent=0
    local skip_percent=0
    
    if [ $TOTAL_FILES -gt 0 ]; then
        success_percent=$((PASSED_FILES * 100 / TOTAL_FILES))
        failure_percent=$((FAILED_FILES * 100 / TOTAL_FILES))
        skip_percent=$((SKIPPED_FILES * 100 / TOTAL_FILES))
    fi
    
    # Progress bar for success rate
    local progress_bar=""
    local filled=$((success_percent / 2))
    local empty=$((50 - filled))
    
    for ((i=0; i<filled; i++)); do
        progress_bar="${progress_bar}█"
    done
    for ((i=0; i<empty; i++)); do
        progress_bar="${progress_bar}░"
    done
    
    echo -e "${GREEN}✅ Passed: ${PASSED_FILES} (${success_percent}%)${NC}"
    echo -e "${RED}❌ Failed: ${FAILED_FILES} (${failure_percent}%)${NC}"
    echo -e "${YELLOW}⏭️  Skipped: ${SKIPPED_FILES} (${skip_percent}%)${NC}"
    echo -e "${WHITE}📁 Total: ${TOTAL_FILES} files${NC}"
    echo -e "${BLUE}⏱️  Execution time: ${execution_time}${NC}"
    echo ""
    echo -e "${WHITE}Success Rate: ${progress_bar} ${success_percent}%${NC}"
    echo ""
    
    # Final result
    if [ $FAILED_FILES -eq 0 ] && [ $TOTAL_FILES -gt 0 ]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED! 🎉${NC}"
        echo -e "${GREEN}🚀 Your Gonex core examples are working perfectly!${NC}"
    elif [ $PASSED_FILES -gt 0 ]; then
        echo -e "${YELLOW}⚠️  PARTIAL SUCCESS${NC}"
        echo -e "${YELLOW}🔧 Some examples failed, but ${PASSED_FILES} passed successfully${NC}"
    else
        echo -e "${RED}💥 ALL TESTS FAILED!${NC}"
        echo -e "${RED}🔧 Please check your setup and try again${NC}"
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Function to run a single file
run_file() {
    local file_path=$1
    local relative_path=$2
    
    TOTAL_FILES=$((TOTAL_FILES + 1))
    
    print_status "SUBHEADER" "Running: $relative_path"
    
    # Check if file exists
    if [ ! -f "$file_path" ]; then
        print_status "ERROR" "File not found: $file_path"
        FAILED_FILES=$((FAILED_FILES + 1))
        FAILED_LIST+=("$relative_path")
        return 1
    fi
    
    # Run the file and capture output
    local output
    local exit_code
    
    output=$(node "$file_path" 2>&1)
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        print_status "SUCCESS" "Passed: $relative_path"
        PASSED_FILES=$((PASSED_FILES + 1))
        PASSED_LIST+=("$relative_path")
        # Display the output
        if [ -n "$output" ]; then
            print_status "INFO" "  → Output:"
            echo "$output" | sed 's/^/    /'
        fi
    else
        print_status "ERROR" "Failed: $relative_path (exit code: $exit_code)"
        FAILED_FILES=$((FAILED_FILES + 1))
        FAILED_LIST+=("$relative_path")
        print_status "WARNING" "  → Error output:"
        echo "$output" | head -10 | sed 's/^/    /'
    fi
    
    echo ""
}

# Function to run all files in a directory recursively
run_directory() {
    local dir_path=$1
    local dir_name=$2
    
    print_status "HEADER" "Directory: $dir_name"
    
    # Check if directory exists
    if [ ! -d "$dir_path" ]; then
        print_status "ERROR" "Directory not found: $dir_path"
        SKIPPED_FILES=$((SKIPPED_FILES + 1))
        SKIPPED_LIST+=("$dir_name (directory not found)")
        return 1
    fi
    
    # Find all .js files in the directory and subdirectories
    local js_files=($(find "$dir_path" -name "*.js" -type f | sort))
    
    if [ ${#js_files[@]} -eq 0 ]; then
        print_status "WARNING" "No .js files found in $dir_name"
        SKIPPED_FILES=$((SKIPPED_FILES + 1))
        SKIPPED_LIST+=("$dir_name (no .js files)")
        return 0
    fi
    
    # Run each .js file
    for file in "${js_files[@]}"; do
        local relative_path=$(echo "$file" | sed "s|^$dir_path/||")
        run_file "$file" "$dir_name/$relative_path"
    done
    
    echo ""
}

# Function to check and build the project
check_and_build() {
    # Check if the dist directory exists (built version)
    if [ ! -d "../dist" ]; then
        print_status "WARNING" "Dist directory not found. Please run 'npm run build' first"
        print_status "INFO" "Attempting to build..."
        cd ..
        if npm run build; then
            print_status "SUCCESS" "Build completed successfully"
        else
            print_status "ERROR" "Build failed! Please run 'npm run build' manually"
            exit 1
        fi
        cd examples
    fi

    # Verify dist directory exists after build
    if [ ! -d "../dist" ]; then
        print_status "ERROR" "Dist directory still not found after build attempt"
        exit 1
    fi
}

# Main execution
main() {
    echo ""
    print_status "INFO" "🚀 Starting Gonex Core Examples Runner"
    echo ""
    print_status "INFO" "This script will run every single JavaScript file under core/ folders"
    echo ""
    
    # Check and build if needed
    check_and_build
    
    # Define all directories to run
    declare -a directories=(
        "core/channels:Channels"
        "core/context:Context"
        "core/context/workers:Context Workers"
        "core/goroutines:Goroutines"
        "core/goroutines/helpers:Goroutines Helpers"
        "core/parallel:Parallel"
        "core/parallel/modes:Parallel Modes"
        "core/select:Select"
        "core/once:Once"
        "core/semaphore:Semaphore"
        "core/mutex:Mutex"
        "core/waitgroups:WaitGroups"
        "core/ticker:Ticker"
        "core/rwmutex:RwMutex"
        "core/cond:Cond"
    )
    
    # Run each directory
    for dir_info in "${directories[@]}"; do
        IFS=':' read -r dir_path dir_name <<< "$dir_info"
        run_directory "$dir_path" "$dir_name"
    done
    
    # Run combined example if it exists
    if [ -f "core/combined.js" ]; then
        print_status "HEADER" "Combined Example"
        run_file "core/combined.js" "Combined Example"
    fi
    
    # Print cool summary
    print_summary
    
    # Exit with appropriate code
    if [ $FAILED_FILES -gt 0 ]; then
        exit 1
    else
        exit 0
    fi
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "core" ]; then
    print_status "ERROR" "Please run this script from the examples directory"
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    print_status "ERROR" "Node.js is not installed or not in PATH"
    exit 1
fi

# Run the main function
main "$@"