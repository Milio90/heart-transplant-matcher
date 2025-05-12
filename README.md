# Heart Transplant Matcher

A web application for matching heart transplant donors with recipients based on Predicted Heart Mass (PHM), the optimal metric for size matching in heart transplantation.

## 📋 Overview

This application implements the research findings from Kransdorf et al. (2019), which demonstrated that Predicted Heart Mass (PHM) is the optimal metric for donor-recipient matching in heart transplantation, superior to traditional metrics like weight, height, BMI, or BSA.

The app allows medical professionals to:

1. Upload an Excel file with recipient data
2. Enter donor information including blood type
3. Calculate PHM for all potential matches
4. Rank recipients by blood type compatibility and match quality
5. Generate a printable report with color-coded risk levels
6. Keep all data local for patient privacy (no server processing)

## 🔬 Scientific Basis

The application implements the PHM formula and risk thresholds from the research paper:

> Kransdorf et al. "Predicted heart mass is the optimal metric for size match in heart transplantation." The Journal of Heart and Lung Transplantation 38.2 (2019): 156-165.

Key findings implemented in this tool:
- PHM ratio below 0.86 is associated with increased mortality risk
- Optimal PHM range is between 0.983-1.039 (well-matched)
- PHM is a more accurate predictor of outcomes than traditional metrics

## 🚀 Getting Started

### Online Demo

You can try the application at: https://milio90.github.io/heart-transplant-matcher/

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/[your-username]/heart-transplant-matcher.git
   cd heart-transplant-matcher
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to http://localhost:5173

## 📊 How to Use

### Preparing Your Data

Create an Excel file with the following columns:
- `id` (Hospital ID)
- `name` (Patient name)
- `gender` (male/female)
- `age` (in years)
- `height` (in cm)
- `weight` (in kg)
- `bloodType` (A+, A-, B+, B-, AB+, AB-, O+, O-)

### Using the Application

1. Upload your Excel file with recipient data
2. Enter the donor information (name, gender, age, height, weight, blood type)
3. Click "Calculate Matches"
4. Review the results (sorted by blood type compatibility, then risk level)
5. Click "Download PDF Report" to generate a printable report

## 📈 Understanding the Results

The matching results include:
- **Blood Type Compatibility**: Shows whether the donor and recipient blood types are compatible
- **PHM Ratio**: Donor PHM / Recipient PHM
- **Match Category**: Based on septiles from the research paper
- **Risk Level**: High Risk (PHM ratio < 0.86) or Acceptable (PHM ratio ≥ 0.86)

Results are sorted by:
1. Blood type compatibility (compatible matches first)
2. Risk level (Acceptable first)
3. Closeness to ideal match (PHM ratio = 1.0)

The application includes a comprehensive blood type compatibility chart showing which donor types are compatible with each recipient type.

## 📄 PDF Report Generation

The application generates a printable report containing:
- Donor information
- A table of all potential recipients with compatibility information
- Color-coded risk levels (red for High Risk, green for Acceptable)
- Blood type compatibility indicators
- Reference information about the risk categories

To generate a report:
1. Click the "Download PDF Report" button after calculating matches
2. A new window will open with the formatted report
3. Use your browser's print function (Ctrl+P or Cmd+P) to save as PDF

## 🔒 Privacy

- All data processing happens locally in the browser
- No data is sent to any servers
- Excel files are processed entirely client-side
- PDF generation occurs using the browser's built-in functionality

## 🧰 Technologies Used

- React.js
- Vite
- Tailwind CSS
- ExcelJS (for Excel file processing)
- Browser-based PDF generation

## ⚠️ Disclaimer

This tool is for educational and research purposes only. Clinical decisions should always be made by qualified healthcare professionals. The application implements published research but has not been independently validated for clinical use.

## 📝 License

MIT
