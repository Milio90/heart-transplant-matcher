# Heart Transplant Matcher

A web application for matching heart transplant donors with recipients based on Predicted Heart Mass (PHM), the optimal metric for size matching in heart transplantation.

## 📋 Overview

This application implements the research findings from Kransdorf et al. (2019), which demonstrated that Predicted Heart Mass (PHM) is the optimal metric for donor-recipient matching in heart transplantation, superior to traditional metrics like weight, height, BMI, or BSA.

The app allows medical professionals to:

1. Upload an Excel file with recipient data
2. Enter donor information
3. Calculate PHM for all potential matches
4. Rank recipients by match quality
5. Generate a downloadable PDF report
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

You can try the application at: https://[your-username].github.io/heart-transplant-matcher/

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

### Using the Application

1. Upload your Excel file with recipient data
2. Enter the donor information (name, gender, age, height, weight)
3. Click "Calculate Matches"
4. Review the results (sorted by match quality)
5. Download the PDF report if needed

## 📈 Understanding the Results

The matching results include:
- **PHM Ratio**: Donor PHM / Recipient PHM
- **Match Category**: Based on septiles from the research paper
- **Risk Level**: High Risk (PHM ratio < 0.86) or Acceptable (PHM ratio ≥ 0.86)

Results are sorted by:
1. Risk level (Acceptable first)
2. Closeness to ideal match (PHM ratio = 1.0)

## 🔒 Privacy

- All data processing happens locally in the browser
- No data is sent to any servers
- No information is stored between sessions
- Excel files are processed entirely client-side

## 🧰 Technologies Used

- React.js
- Vite
- Tailwind CSS
- ExcelJS (for Excel file processing)
- jsPDF (for PDF generation)

## ⚠️ Disclaimer

This tool is for educational and research purposes only. Clinical decisions should always be made by qualified healthcare professionals. The application implements published research but has not been independently validated for clinical use.

## 📝 License

[Choose an appropriate license, e.g., MIT, Apache 2.0]

## 👨‍💻 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact

[Your contact information if you want to include it]
