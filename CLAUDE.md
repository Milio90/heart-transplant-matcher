# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Heart Transplant Matcher is a React web application that implements the scientific research from Kransdorf et al. (2019) for matching heart transplant donors with recipients based on Predicted Heart Mass (PHM). The application processes Excel files containing recipient data and calculates optimal matches based on PHM ratios, blood type compatibility, and priority factors.

## Common Development Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview

# Deploy to GitHub Pages
npm run deploy
```

## Architecture

### Core Components
- **App.jsx**: Main application wrapper - simply renders HeartTransplantMatcher component
- **HeartTransplantMatcher.jsx**: Single-page application containing all functionality:
  - Excel file processing using ExcelJS library
  - PHM calculations implementing Kransdorf et al. formulas
  - Blood type compatibility logic (ABO and Rhesus factor checking)
  - Match ranking algorithm with multiple sorting criteria
  - PDF report generation using browser print functionality

### Key Technical Details

**PHM Calculation Logic** (`HeartTransplantMatcher.jsx:59-74`):
- Implements Left Ventricular Mass (LVM) and Right Ventricular Mass (RVM) formulas
- Gender-specific coefficients for accurate heart mass prediction
- Critical for determining donor-recipient compatibility

**Match Ranking System** (`HeartTransplantMatcher.jsx:275-294`):
1. PHM Risk Level (Acceptable matches first)
2. ABO Blood Type Compatibility
3. Patient Status (1=highest priority, 7=lowest)
4. Date Added to waiting list (older patients first)

**Blood Type Compatibility**:
- ABO compatibility logic (`HeartTransplantMatcher.jsx:50-57`)
- Rhesus factor mismatch warnings (`HeartTransplantMatcher.jsx:32-40`)
- Separate handling allows for nuanced compatibility assessment

## Excel File Processing

Expected columns in recipient data:
- `dateadded`: Date patient added to waiting list
- `id`: Hospital/Patient ID
- `name`: Patient name
- `gender`: male/female
- `age`: Age in years
- `height`: Height in cm
- `weight`: Weight in kg
- `bloodType`: Including Rh factor (A+, B-, O+, AB-, etc.)
- `status`: Priority level (1-7, where 1 is highest priority)

## Technology Stack

- **Frontend**: React 19.1.0 with functional components and hooks
- **Build Tool**: Vite with React plugin
- **Styling**: Tailwind CSS
- **Excel Processing**: ExcelJS library
- **Deployment**: GitHub Pages via gh-pages package

## Deployment Configuration

- Base URL configured for GitHub Pages deployment: `/heart-transplant-matcher/`
- Build artifacts deployed to `dist` directory
- Predeploy hook automatically builds before deployment