#!/bin/bash

# Function to count files in current directory
count_files() {
    ls -1 | wc -l | tr -d ' '
}

# Function to run the guessing game
run_game() {
    local correct
    correct=$(count_files)

    echo "Welcome to the Guessing Game!"
    echo "How many files are in the current directory?"

    while true; do
        read -rp "Enter your guess: " guess

        if ! [[ "$guess" =~ ^[0-9]+$ ]]; then
            echo "Please enter a valid number."
            continue
        fi

        if [ "$guess" -lt "$correct" ]; then
            echo "Too low! Try again."
        elif [ "$guess" -gt "$correct" ]; then
            echo "Too high! Try again."
        else
            echo "Congratulations! You guessed correctly! There are $correct files in this directory."
            break
        fi
    done
}

# Run the game
run_game
