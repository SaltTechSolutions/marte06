#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ASCII Art Logo
show_logo() {
    clear
    echo -e "${BLUE}"
    cat << "EOF"
  __  __            _
 |  \/  | __ _ _ __| |_ ___
 | |\/| |/ _` | '__| __/ _ \
 | |  | | (_| | |  | ||  __/
 |_|  |_|\__,_|_|   \__\___|

EOF
    echo -e "${NC}"
    echo -e "${BLUE}Marte Development CLI${NC}"
    echo "--------------------------------"
}

# Function to pause and wait for user input
pause() {
    echo -e "\n${YELLOW}Press Enter to continue...${NC}"
    read
}

# Local Development
run_dev() {
    echo -e "\n${GREEN}Starting Local Development Server...${NC}"
    npm run dev
    pause
}

# Git Push
git_push() {
    echo -e "\n${GREEN}Git Push Interactive Mode${NC}"
    echo "--------------------------------"

    # Show status
    git status

    echo -e "\n${YELLOW}Do you want to proceed with staging all changes? (y/n)${NC}"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        git add .
        
        echo -e "\n${YELLOW}Enter commit message:${NC}"
        read -r commit_msg
        
        if [ -n "$commit_msg" ]; then
            git commit -m "$commit_msg"
            
            echo -e "\n${YELLOW}Pushing to remote...${NC}"
            git push
            
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}Successfully pushed!${NC}"
            else
                echo -e "${RED}Push failed!${NC}"
            fi
        else
             echo -e "${RED}Commit message cannot be empty. Aborting.${NC}"
        fi
    else
        echo -e "${RED}Aborted.${NC}"
    fi
    pause
}

# Firebase Deploy
firebase_deploy() {
    echo -e "\n${GREEN}Firebase Deploy Interactive Mode${NC}"
    echo "--------------------------------"
    echo "1) Deploy EVERYTHING"
    echo "2) Deploy Hosting only"
    echo "3) Deploy Firestore (Rules & Indexes) only"
    echo "4) Deploy Functions only"
    echo "5) Cancel"
    
    echo -e "\n${YELLOW}Select an option:${NC}"
    read -r choice
    
    case $choice in
        1)
            echo -e "${YELLOW}Deploying everything...${NC}"
            firebase deploy
            ;;
        2)
            echo -e "${YELLOW}Deploying Hosting...${NC}"
            firebase deploy --only hosting
            ;;
        3)
            echo -e "${YELLOW}Deploying Firestore...${NC}"
            firebase deploy --only firestore
            ;;
        4)
            echo -e "${YELLOW}Deploying Functions...${NC}"
            firebase deploy --only functions
            ;;
        5)
            echo "Cancelled."
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            ;;
    esac
    pause
}

# Main Loop
while true; do
    show_logo
    echo "1) 🚀 Local Dev (npm run dev)"
    echo "2) 💾 Git Push (Interactive)"
    echo "3) 🔥 Firebase Deploy"
    echo "4) ❌ Exit"
    
    echo -e "\n${YELLOW}Select an option [1-4]:${NC}"
    read -r option
    
    case $option in
        1)
            run_dev
            ;;
        2)
            git_push
            ;;
        3)
            firebase_deploy
            ;;
        4)
            echo -e "${GREEN}Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option. Please try again.${NC}"
            sleep 1
            ;;
    esac
done
