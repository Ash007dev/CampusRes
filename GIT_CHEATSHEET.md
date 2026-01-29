# 📖 Git Cheatsheet for CampusRes

## 🔍 View Branches
```bash
git branch              # List local branches
git branch -a           # List all branches (local + remote)
git branch -r           # List only remote branches
```

---

## 🌿 Switch Branches
```bash
git checkout dev-ashish          # Switch to your branch
git checkout main                # Switch to main
git checkout -b new-feature      # Create and switch to new branch
```

---

## 📥 Get Latest Changes
```bash
git fetch origin                 # Fetch all remote updates
git pull origin main             # Pull latest main into current branch
git pull origin dev-ashish       # Pull specific branch
```

---

## 💾 Save Your Work
```bash
git status                       # See changed files
git add .                        # Stage all changes
git add filename.ts              # Stage specific file
git commit -m "Your message"     # Commit with message
git push origin dev-ashish       # Push to your branch
```

---

## 🔀 Merge Changes
```bash
# Merge main into your branch (get latest updates)
git checkout dev-ashish
git merge main

# Merge your work into main (after PR approved)
git checkout main
git merge dev-ashish
git push origin main
```

---

## 🚨 Undo Mistakes
```bash
git checkout -- filename.ts      # Discard changes in file
git reset HEAD filename.ts       # Unstage a file
git reset --soft HEAD~1          # Undo last commit (keep changes)
git reset --hard HEAD~1          # Undo last commit (delete changes) ⚠️
git stash                        # Temporarily save changes
git stash pop                    # Restore stashed changes
```

---

## 📋 View History
```bash
git log --oneline -10            # Last 10 commits (short)
git log --graph --oneline        # Visual branch graph
git diff                         # See unstaged changes
git diff --staged                # See staged changes
```

---

## 👥 Team Workflow

### Your Daily Workflow:
```bash
# 1. Start of day - get latest
git checkout dev-ashish
git pull origin main

# 2. Work on features, then commit
git add .
git commit -m "Add booking validation"

# 3. End of day - push your work
git push origin dev-ashish
```

### Merging to Main (via Pull Request):
1. Push your branch: `git push origin dev-ashish`
2. Go to GitHub → Create Pull Request
3. Get teammate review
4. Merge on GitHub

---

## 🏷️ Your Branches
| Branch | Owner |
|--------|-------|
| `main` | Protected (stable code) |
| `dev-ashish` | Ashish |
| `dev-darun` | Darun |
| `dev-adwaitha` | Adwaitha |
| `dev-sanhitha` | Sanhitha |
| `dev-arya` | Arya |
