#!/bin/bash

# Interactive Git Workflow Script
# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Git Workflow Assistant${NC}"
echo "================================"

# Show current status
echo -e "\n${CYAN}📊 Current Git Status:${NC}"
git status

# Get all modified and untracked files
modified_files=($(git diff --name-only))
untracked_files=($(git ls-files --others --exclude-standard))
staged_files=($(git diff --cached --name-only))

all_files=("${modified_files[@]}" "${untracked_files[@]}")

if [ ${#all_files[@]} -eq 0 ] && [ ${#staged_files[@]} -eq 0 ]; then
    echo -e "\n${GREEN}✅ No changes detected. Working directory is clean!${NC}"
    exit 0
fi

# Show what's already staged
if [ ${#staged_files[@]} -gt 0 ]; then
    echo -e "\n${GREEN}📋 Already Staged Files:${NC}"
    for i in "${!staged_files[@]}"; do
        echo -e "   ${GREEN}✓${NC} ${staged_files[$i]}"
    done
fi

# File selection for staging
if [ ${#all_files[@]} -gt 0 ]; then
    echo -e "\n${YELLOW}📁 Files Available to Stage:${NC}"
    echo "0) Add all files"
    echo "00) Skip file selection (use already staged files)"
    
    for i in "${!all_files[@]}"; do
        file="${all_files[$i]}"
        # Check if file is modified or untracked
        if [[ " ${modified_files[*]} " =~ " ${file} " ]]; then
            echo -e "$((i+1))) ${YELLOW}M${NC} $file"
        else
            echo -e "$((i+1))) ${GREEN}A${NC} $file"
        fi
    done
    
    echo -e "\n${BLUE}Enter file numbers to stage (space-separated, e.g., '1 3 5'):${NC}"
    read -r file_selection
    
    if [ "$file_selection" = "0" ]; then
        echo -e "${YELLOW}📦 Adding all files...${NC}"
        git add .
    elif [ "$file_selection" = "00" ]; then
        echo -e "${BLUE}📋 Using already staged files...${NC}"
    elif [ -n "$file_selection" ]; then
        echo -e "${YELLOW}📦 Adding selected files...${NC}"
        for num in $file_selection; do
            if [ "$num" -gt 0 ] && [ "$num" -le "${#all_files[@]}" ]; then
                file_to_add="${all_files[$((num-1))]}"
                git add "$file_to_add"
                echo -e "   ${GREEN}✓${NC} Added: $file_to_add"
            else
                echo -e "   ${RED}✗${NC} Invalid selection: $num"
            fi
        done
    fi
fi

# Ask about gitignore
echo -e "\n${PURPLE}🚫 Do you want to add any files to .gitignore? (y/n):${NC}"
read -r add_to_gitignore

if [ "$add_to_gitignore" = "y" ] || [ "$add_to_gitignore" = "Y" ]; then
    echo -e "${BLUE}Enter files/patterns to ignore (one per line, empty line to finish):${NC}"
    echo "Examples: build/, *.log, .DS_Store, node_modules/"
    
    while true; do
        read -r ignore_pattern
        if [ -z "$ignore_pattern" ]; then
            break
        fi
        echo "$ignore_pattern" >> .gitignore
        echo -e "   ${GREEN}✓${NC} Added to .gitignore: $ignore_pattern"
    done
    
    # Stage the updated .gitignore
    git add .gitignore
    echo -e "${GREEN}📝 .gitignore updated and staged${NC}"
fi

# Show what's staged now
staged_now=($(git diff --cached --name-only))
if [ ${#staged_now[@]} -eq 0 ]; then
    echo -e "\n${RED}❌ No files staged for commit. Exiting.${NC}"
    exit 1
fi

echo -e "\n${GREEN}📋 Final Staged Files:${NC}"
for file in "${staged_now[@]}"; do
    echo -e "   ${GREEN}✓${NC} $file"
done

# Get commit message
echo -e "\n${CYAN}💬 Commit Message Options:${NC}"
echo "1) Write custom message"
echo "2) Use conventional commit format"

read -r message_choice

if [ "$message_choice" = "2" ]; then
    echo -e "\n${BLUE}🏷️  Select commit type:${NC}"
    echo "1) feat: New feature"
    echo "2) fix: Bug fix"  
    echo "3) style: UI/styling changes"
    echo "4) refactor: Code refactoring"
    echo "5) docs: Documentation"
    echo "6) chore: Maintenance"
    echo "7) perf: Performance improvement"
    echo "8) test: Adding tests"
    
    read -r type_choice
    
    case $type_choice in
        1) commit_type="feat" ;;
        2) commit_type="fix" ;;
        3) commit_type="style" ;;
        4) commit_type="refactor" ;;
        5) commit_type="docs" ;;
        6) commit_type="chore" ;;
        7) commit_type="perf" ;;
        8) commit_type="test" ;;
        *) commit_type="feat" ;;
    esac
    
    echo -e "${BLUE}Enter commit description:${NC}"
    read -r description
    
    echo -e "${BLUE}Enter detailed description (optional, press Enter to skip):${NC}"
    read -r details
    
    if [ -n "$details" ]; then
        commit_message="$commit_type: $description

$details"
    else
        commit_message="$commit_type: $description"
    fi
else
    echo -e "${BLUE}Enter your commit message:${NC}"
    read -r commit_message
fi

# Commit
if [ -n "$commit_message" ]; then
    git commit -m "$commit_message"
    echo -e "${GREEN}✅ Changes committed successfully!${NC}"
else
    echo -e "${RED}❌ No commit message provided. Aborting.${NC}"
    exit 1
fi

# Push options
echo -e "\n${CYAN}🚀 Push Options:${NC}"
echo "1) Push to main"
echo "2) Push to development" 
echo "3) Push to current branch ($(git branch --show-current))"
echo "4) Don't push (commit locally only)"

read -r push_choice

case $push_choice in
    1)
        echo -e "${YELLOW}🚀 Pushing to main...${NC}"
        git push origin main
        echo -e "${GREEN}✅ Pushed to main successfully!${NC}"
        ;;
    2)
        echo -e "${YELLOW}🚀 Pushing to development...${NC}"
        git push origin development
        echo -e "${GREEN}✅ Pushed to development successfully!${NC}"
        ;;
    3)
        current_branch=$(git branch --show-current)
        echo -e "${YELLOW}🚀 Pushing to $current_branch...${NC}"
        git push origin "$current_branch"
        echo -e "${GREEN}✅ Pushed to $current_branch successfully!${NC}"
        ;;
    4)
        echo -e "${BLUE}📦 Changes committed locally only${NC}"
        ;;
    *)
        echo -e "${RED}Invalid choice. Changes committed locally only.${NC}"
        ;;
esac

echo -e "\n${GREEN}🎉 Git workflow completed!${NC}"