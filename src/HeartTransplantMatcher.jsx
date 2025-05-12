// HeartTransplantMatcher.jsx - Complete version with blood type support and PDF fixes
import React, { useState } from 'react';
import ExcelJS from 'exceljs';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

const HeartTransplantMatcher = () => {
  const [recipients, setRecipients] = useState([]);
  const [donor, setDonor] = useState({
    name: '',
    gender: '',
    age: '',
    height: '',
    weight: '',
    bloodType: ''
  });
  const [matchResults, setMatchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState(null);

  // Available blood types
  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  // Blood type compatibility chart (recipient can receive from donor)
  const bloodTypeCompatibility = {
    'A+': ['A+', 'A-', 'O+', 'O-'],
    'A-': ['A-', 'O-'],
    'B+': ['B+', 'B-', 'O+', 'O-'],
    'B-': ['B-', 'O-'],
    'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    'AB-': ['A-', 'B-', 'AB-', 'O-'],
    'O+': ['O+', 'O-'],
    'O-': ['O-']
  };

// Calculate PHM based on formula from the uploaded document
  const calculatePHM = (gender, age, height, weight) => {
    // Convert height from cm to m if needed
    const heightInM = height > 3 ? height / 100 : height;
    
    // Calculate LVM (Left Ventricular Mass)
    const lvmCoefficient = gender.toLowerCase() === 'female' ? 6.82 : 8.25;
    const lvm = lvmCoefficient * Math.pow(heightInM, 0.54) * Math.pow(weight, 0.61);
    
    // Calculate RVM (Right Ventricular Mass)
    const rvmCoefficient = gender.toLowerCase() === 'female' ? 10.59 : 11.25;
    const rvm = rvmCoefficient * Math.pow(age, -0.32) * Math.pow(heightInM, 1.135) * Math.pow(weight, 0.315);
    
    // PHM = RVM + LVM
    return rvm + lvm;
  };

  // Calculate donor-to-recipient PHM ratio
  const calculatePHMRatio = (donorPHM, recipientPHM) => {
    return donorPHM / recipientPHM;
  };

  // Determine match category based on PHM ratio (using the septiles from the document)
  const determineMatchCategory = (phmRatio) => {
    if (phmRatio < 0.863) return 'U3 - Severely Undersized';
    if (phmRatio < 0.929) return 'U2 - Moderately Undersized';
    if (phmRatio < 0.983) return 'U1 - Mildly Undersized';
    if (phmRatio < 1.039) return 'R - Well-Matched';
    if (phmRatio < 1.111) return 'O1 - Mildly Oversized';
    if (phmRatio < 1.221) return 'O2 - Moderately Oversized';
    return 'O3 - Severely Oversized';
  };

  // Determine risk level based on PHM ratio
  const determineRiskLevel = (phmRatio) => {
    if (phmRatio < 0.86) return 'High Risk';
    return 'Acceptable';
  };

  // Check blood type compatibility
  const isBloodTypeCompatible = (donorBloodType, recipientBloodType) => {
    if (!donorBloodType || !recipientBloodType) return false;
    return bloodTypeCompatibility[recipientBloodType]?.includes(donorBloodType) || false;
  };

const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    setFile(file);
    setError('');
    
    if (!file) return;
    
    try {
      setIsLoading(true);
      const workbook = new ExcelJS.Workbook();
      
      // Read the Excel file
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);
      
      // Get the first worksheet
      const worksheet = workbook.worksheets[0];
      
      if (!worksheet) {
        setError('No worksheet found in the Excel file.');
        setIsLoading(false);
        return;
      }
      
      // Convert worksheet to JSON
      const jsonData = [];
      const headers = [];
      
      // Get headers
      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber - 1] = cell.value.toString().toLowerCase();
      });
      
      // Check for required columns
      const requiredColumns = ['id', 'name', 'gender', 'age', 'height', 'weight'];
      const missingColumns = requiredColumns.filter(col => !headers.includes(col));
      
      if (missingColumns.length) {
        setError(`Missing required columns: ${missingColumns.join(', ')}`);
        setIsLoading(false);
        return;
      }

      // Warn if bloodType column is missing
      if (!headers.includes('bloodtype')) {
        setError('Warning: No "bloodType" column found. Blood type matching will be disabled.');
      }
      
      // Convert rows to JSON
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row
        
        const rowData = {};
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber - 1];
          rowData[header] = cell.value;
        });
        
        // Normalize the blood type field name
        if (rowData.bloodtype && !rowData.bloodType) {
          rowData.bloodType = rowData.bloodtype;
          delete rowData.bloodtype;
        }
        
        jsonData.push(rowData);
      });
      
      if (jsonData.length === 0) {
        setError('The uploaded file contains no data.');
        setIsLoading(false);
        return;
      }
      
      setRecipients(jsonData);
      setIsLoading(false);
    } catch (err) {
      console.error('File processing error:', err);
      setError(`Error processing file: ${err.message || 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  const handleDonorChange = (e) => {
    const { name, value } = e.target;
    setDonor(prev => ({ ...prev, [name]: value }));
  };
  
  const handleCalculateMatches = () => {
    // Validate donor data
    const donorFields = ['name', 'gender', 'age', 'height', 'weight', 'bloodType'];
    const missingFields = donorFields.filter(field => !donor[field]);
    
    if (missingFields.length) {
      setError(`Please fill in all donor fields: ${missingFields.join(', ')}`);
      return;
    }

    // Numeric validation
    const numericFields = ['age', 'height', 'weight'];
    for (const field of numericFields) {
      if (isNaN(parseFloat(donor[field]))) {
        setError(`Donor ${field} must be a number`);
        return;
      }
    }
    
    if (!recipients.length) {
      setError('Please upload a recipient list first');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Calculate donor PHM
      const donorPHM = calculatePHM(
        donor.gender,
        parseFloat(donor.age),
        parseFloat(donor.height),
        parseFloat(donor.weight)
      );
      
      // Calculate match for each recipient
      const results = recipients.map(recipient => {
        // Calculate recipient PHM
        const recipientPHM = calculatePHM(
          recipient.gender,
          parseFloat(recipient.age),
          parseFloat(recipient.height),
          parseFloat(recipient.weight)
        );
        
        const phmRatio = calculatePHMRatio(donorPHM, recipientPHM);
        const matchCategory = determineMatchCategory(phmRatio);
        const riskLevel = determineRiskLevel(phmRatio);
        
        // Check blood type compatibility
        const bloodTypeMatch = isBloodTypeCompatible(donor.bloodType, recipient.bloodType);
        const exactBloodTypeMatch = donor.bloodType === recipient.bloodType;
        
        return {
          ...recipient,
          donorPHM,
          recipientPHM,
          phmRatio,
          matchCategory,
          riskLevel,
          bloodTypeMatch,
          exactBloodTypeMatch
        };
      });
      
      // Sort by:
      // 1. Blood type compatibility (exact matches first, then compatible, then incompatible)
      // 2. Risk level (Acceptable first)
      // 3. Proximity to ideal PHM ratio
      const sortedResults = [...results].sort((a, b) => {
        // First sort by blood type compatibility
        if (a.bloodTypeMatch !== b.bloodTypeMatch) {
          return a.bloodTypeMatch ? -1 : 1;
        }
        
        // Then sort by exact blood type match
        if (a.exactBloodTypeMatch !== b.exactBloodTypeMatch) {
          return a.exactBloodTypeMatch ? -1 : 1;
        }
        
        // Then sort by risk level
        if (a.riskLevel !== b.riskLevel) {
          return a.riskLevel === 'Acceptable' ? -1 : 1;
        }
        
        // Then sort by how close the ratio is to 1.0
        return Math.abs(a.phmRatio - 1) - Math.abs(b.phmRatio - 1);
      });
      
      setMatchResults(sortedResults);
    } catch (err) {
      console.error('Calculation error:', err);
      setError(`Error calculating matches: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

const generatePDF = () => {
  if (!matchResults.length) {
    setError('No results to export');
    return;
  }
  
  try {
    // Register fonts
    pdfMake.vfs = pdfFonts.pdfMake.vfs;
    
    // Add a Greek-compatible font
    pdfMake.fonts = {
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf'
      }
    };
    
    // Create document definition
    const docDefinition = {
      content: [
        // Title
        { text: 'Heart Transplant Match Report', style: 'header' },
        
        // Donor information
        { text: `Donor: ${donor.name}`, margin: [0, 10, 0, 0] },
        { text: `Gender: ${donor.gender}, Age: ${donor.age}, Blood Type: ${donor.bloodType}` },
        { text: `Height: ${donor.height}cm, Weight: ${donor.weight}kg` },
        { text: `Donor Predicted Heart Mass: ${matchResults[0].donorPHM.toFixed(2)}g` },
        { text: `Generated on: ${new Date().toLocaleDateString()}`, margin: [0, 0, 0, 10] },
        
        // Table
        {
          table: {
            headerRows: 1,
            widths: [20, 30, 80, 25, 35, 30, 50, 50, 50, 35, 80, 50],
            body: [
              // Header row
              [
                { text: 'Rank', style: 'tableHeader' },
                { text: 'ID', style: 'tableHeader' },
                { text: 'Name', style: 'tableHeader' },
                { text: 'Gender', style: 'tableHeader' },
                { text: 'Blood Type', style: 'tableHeader' },
                { text: 'Compatible', style: 'tableHeader' },
                { text: 'Age', style: 'tableHeader' },
                { text: 'Recipient PHM', style: 'tableHeader' },
                { text: 'Donor PHM', style: 'tableHeader' },
                { text: 'PHM Ratio', style: 'tableHeader' },
                { text: 'Match Category', style: 'tableHeader' },
                { text: 'Risk Level', style: 'tableHeader' }
              ],
              // Data rows
              ...matchResults.map((result, index) => [
                index + 1,
                result.id,
                result.name,
                result.gender,
                result.bloodType || "Unknown",
                result.bloodTypeMatch ? "✓" : "✗",
                result.age,
                `${result.recipientPHM.toFixed(2)}g`,
                `${result.donorPHM.toFixed(2)}g`,
                result.phmRatio.toFixed(2),
                result.matchCategory,
                {
                  text: result.riskLevel,
                  fillColor: result.riskLevel === 'High Risk' ? '#fecaca' : '#bbf7d0',
                  color: result.riskLevel === 'High Risk' ? '#991b1b' : '#166534'
                }
              ])
            ]
          }
        },
        
        // Risk Categories
        { text: 'Risk Categories:', style: 'subheader', margin: [0, 15, 0, 5] },
        { text: 'High Risk: PHM ratio < 0.86' },
        { text: 'Acceptable: PHM ratio ≥ 0.86' },
        
        // Note on sorting
        { text: 'Note: Matches are sorted by:', margin: [0, 10, 0, 0] },
        { text: '1. Blood type compatibility', margin: [10, 0, 0, 0] },
        { text: '2. Risk level', margin: [10, 0, 0, 0] },
        { text: '3. Proximity to ideal ratio (1.0)', margin: [10, 0, 0, 0] },
        
        // Reference
        { 
          text: 'Based on: Kransdorf et al. "Predicted heart mass is the optimal metric for size match in heart transplantation" (2019)',
          style: 'reference',
          margin: [0, 15, 0, 0]
        }
      ],
      
      // Styles
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          margin: [0, 0, 0, 10]
        },
        subheader: {
          fontSize: 14,
          bold: true
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: 'white',
          fillColor: '#4285F4'
        },
        reference: {
          fontSize: 10,
          italics: true
        }
      },
      
      // Default font
      defaultStyle: {
        font: 'Roboto'
      }
    };
    
    // Generate PDF
    const fileName = `heart_match_${donor.name.replace(/\s+/g, '_')}_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`;
    pdfMake.createPdf(docDefinition).download(fileName);
    
  } catch (err) {
    console.error('PDF generation error:', err);
    setError(`Error generating PDF: ${err.message || 'Unknown error'}`);
  }
};
  
  return (
    <div className="p-6 max-w-6xl mx-auto bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-blue-700">Heart Transplant Matching Tool</h1>
      
      {/* File Upload Section */}
      <div className="mb-8 p-4 border rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold mb-3">Step 1: Upload Recipient List</h2>
        <p className="mb-3 text-sm text-gray-600">Upload an Excel file (.xlsx) containing recipient information with columns: id, name, gender, age, height (cm), weight (kg), bloodType</p>
        <div className="flex items-center">
          <input 
            type="file" 
            onChange={handleFileUpload} 
            accept=".xlsx, .xls" 
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
          {file && <span className="ml-2 text-green-600">✓ {file.name}</span>}
        </div>
        {recipients.length > 0 && (
          <p className="mt-2 text-green-600">{recipients.length} recipients loaded successfully</p>
        )}
      </div>
      
      {/* Donor Information Section */}
      <div className="mb-8 p-4 border rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold mb-3">Step 2: Enter Donor Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input 
              type="text" 
              name="name" 
              value={donor.name} 
              onChange={handleDonorChange} 
              className="w-full p-2 border rounded"
              placeholder="Donor name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select 
              name="gender" 
              value={donor.gender} 
              onChange={handleDonorChange} 
              className="w-full p-2 border rounded"
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Blood Type</label>
            <select 
              name="bloodType" 
              value={donor.bloodType} 
              onChange={handleDonorChange} 
              className="w-full p-2 border rounded"
            >
              <option value="">Select blood type</option>
              {bloodTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Age (years)</label>
            <input 
              type="number" 
              name="age" 
              value={donor.age} 
              onChange={handleDonorChange} 
              className="w-full p-2 border rounded"
              placeholder="Age in years"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
            <input 
              type="number" 
              name="height" 
              value={donor.height} 
              onChange={handleDonorChange} 
              className="w-full p-2 border rounded"
              placeholder="Height in cm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
            <input 
              type="number" 
              name="weight" 
              value={donor.weight} 
              onChange={handleDonorChange} 
              className="w-full p-2 border rounded"
              placeholder="Weight in kg"
            />
          </div>
        </div>
      </div>
            
      {/* Calculate Button */}
      <div className="flex justify-center mb-6">
        <button 
          onClick={handleCalculateMatches}
          disabled={isLoading} 
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300"
        >
          {isLoading ? 'Calculating...' : 'Calculate Matches'}
        </button>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="mb-6 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {/* Results Section */}
      {matchResults.length > 0 && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Match Results</h2>
            <button 
              onClick={generatePDF}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
            >
              Download PDF Report
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-2 px-4 border">Rank</th>
                  <th className="py-2 px-4 border">ID</th>
                  <th className="py-2 px-4 border">Name</th>
                  <th className="py-2 px-4 border">Gender</th>
                  <th className="py-2 px-4 border">Blood Type</th>
                  <th className="py-2 px-4 border">Compatible</th>
                  <th className="py-2 px-4 border">Age</th>
                  <th className="py-2 px-4 border">Recipient PHM</th>
                  <th className="py-2 px-4 border">Donor PHM</th>
                  <th className="py-2 px-4 border">PHM Ratio</th>
                  <th className="py-2 px-4 border">Match Category</th>
                  <th className="py-2 px-4 border">Risk Level</th>
                </tr>
              </thead>
              <tbody>
                {matchResults.map((result, index) => (
                  <tr key={index}>
                    <td className="py-2 px-4 border text-center">{index + 1}</td>
                    <td className="py-2 px-4 border">{result.id}</td>
                    <td className="py-2 px-4 border">{result.name}</td>
                    <td className="py-2 px-4 border">{result.gender}</td>
                    <td className="py-2 px-4 border">{result.bloodType || "Unknown"}</td>
                    <td className="py-2 px-4 border text-center font-bold">
                      {result.bloodTypeMatch ? 
                        <span style={{color: '#16a34a'}}>✓</span> : 
                        <span style={{color: '#dc2626'}}>✗</span>
                      }
                    </td>
                    <td className="py-2 px-4 border">{result.age}</td>
                    <td className="py-2 px-4 border">{result.recipientPHM.toFixed(2)}g</td>
                    <td className="py-2 px-4 border">{result.donorPHM.toFixed(2)}g</td>
                    <td className="py-2 px-4 border font-semibold">{result.phmRatio.toFixed(2)}</td>
                    <td className="py-2 px-4 border">{result.matchCategory}</td>
                    <td className="py-2 px-4 border font-bold" style={{
                      backgroundColor: result.riskLevel === 'High Risk' ? '#fecaca' : '#bbf7d0',
                      color: result.riskLevel === 'High Risk' ? '#991b1b' : '#166534'
                    }}>
                      {result.riskLevel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
                    
          {/* Information about criteria */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Match Criteria Information:</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Blood Type Compatibility:</strong> Recipients are prioritized by blood type compatibility with the donor</li>
                    <li><strong>PHM (Predicted Heart Mass):</strong> Calculated using formulas from Kransdorf et al. research</li>
                    <li><strong>High Risk:</strong> Donor-to-recipient PHM ratio &lt; 0.86</li>
                    <li><strong>Optimal match:</strong> Donor-to-recipient PHM ratio between 0.983 and 1.039 (Well-Matched)</li>
                    <li><strong>Results sorting:</strong> Blood type compatibility first, then risk level, then closeness to optimal ratio (1.0)</li>
                  </ul>
                </div>
                
                {/* Blood type compatibility chart */}
                <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Blood Type Compatibility Chart:</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border mt-2">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="py-2 px-3 border">Recipient Blood Type</th>
                          <th className="py-2 px-3 border text-center" colSpan="8">Compatible Donor Blood Types</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="py-2 px-3 border font-semibold">O-</td>
                          <td className="py-2 px-3 border text-center bg-green-100">O-</td>
                          <td className="py-2 px-3 border text-center bg-red-100">O+</td>
                          <td className="py-2 px-3 border text-center bg-red-100">A-</td>
                          <td className="py-2 px-3 border text-center bg-red-100">A+</td>
                          <td className="py-2 px-3 border text-center bg-red-100">B-</td>
                          <td className="py-2 px-3 border text-center bg-red-100">B+</td>
                          <td className="py-2 px-3 border text-center bg-red-100">AB-</td>
                          <td className="py-2 px-3 border text-center bg-red-100">AB+</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 border font-semibold">O+</td>
                          <td className="py-2 px-3 border text-center bg-green-100">O-</td>
                          <td className="py-2 px-3 border text-center bg-green-100">O+</td>
                          <td className="py-2 px-3 border text-center bg-red-100">A-</td>
                          <td className="py-2 px-3 border text-center bg-red-100">A+</td>
                          <td className="py-2 px-3 border text-center bg-red-100">B-</td>
                          <td className="py-2 px-3 border text-center bg-red-100">B+</td>
                          <td className="py-2 px-3 border text-center bg-red-100">AB-</td>
                          <td className="py-2 px-3 border text-center bg-red-100">AB+</td>
                        </tr>

                        <tr>
                                            <td className="py-2 px-3 border font-semibold">A-</td>
                                            <td className="py-2 px-3 border text-center bg-green-100">O-</td>
                                            <td className="py-2 px-3 border text-center bg-red-100">O+</td>
                                            <td className="py-2 px-3 border text-center bg-green-100">A-</td>
                                            <td className="py-2 px-3 border text-center bg-red-100">A+</td>
                                            <td className="py-2 px-3 border text-center bg-red-100">B-</td>
                                            <td className="py-2 px-3 border text-center bg-red-100">B+</td>
                                            <td className="py-2 px-3 border text-center bg-red-100">AB-</td>
                                            <td className="py-2 px-3 border text-center bg-red-100">AB+</td>
                                          </tr>
                                          <tr>
                                            <td className="py-2 px-3 border font-semibold">A+</td>
                                            <td className="py-2 px-3 border text-center bg-green-100">O-</td>
                                            <td className="py-2 px-3 border text-center bg-green-100">O+</td>
                                            <td className="py-2 px-3 border text-center bg-green-100">A-</td>
                                            <td className="py-2 px-3 border text-center bg-green-100">A+</td>
                                            <td className="py-2 px-3 border text-center bg-red-100">B-</td>
                                            <td className="py-2 px-3 border text-center bg-red-100">B+</td>
                                            <td className="py-2 px-3 border text-center bg-red-100">AB-</td>
                                            <td className="py-2 px-3 border text-center bg-red-100">AB+</td>
                                                              </tr>
                                                              <tr>
                                                                <td className="py-2 px-3 border font-semibold">B-</td>
                                                                <td className="py-2 px-3 border text-center bg-green-100">O-</td>
                                                                <td className="py-2 px-3 border text-center bg-red-100">O+</td>
                                                                <td className="py-2 px-3 border text-center bg-red-100">A-</td>
                                                                <td className="py-2 px-3 border text-center bg-red-100">A+</td>
                                                                <td className="py-2 px-3 border text-center bg-green-100">B-</td>
                                                                <td className="py-2 px-3 border text-center bg-red-100">B+</td>
                                                                <td className="py-2 px-3 border text-center bg-red-100">AB-</td>
                                                                <td className="py-2 px-3 border text-center bg-red-100">AB+</td>
                                                              </tr>
                                                              <tr>
                                                                <td className="py-2 px-3 border font-semibold">B+</td>
                                                                <td className="py-2 px-3 border text-center bg-green-100">O-</td>
                                                                <td className="py-2 px-3 border text-center bg-green-100">O+</td>
                                                                <td className="py-2 px-3 border text-center bg-red-100">A-</td>
                                                                <td className="py-2 px-3 border text-center bg-red-100">A+</td>
                                                                <td className="py-2 px-3 border text-center bg-green-100">B-</td>
                                                                <td className="py-2 px-3 border text-center bg-green-100">B+</td>
                                                                <td className="py-2 px-3 border text-center bg-red-100">AB-</td>
                                                                <td className="py-2 px-3 border text-center bg-red-100">AB+</td>
                                                              </tr>
                                                              <tr>
                                                                                  <td className="py-2 px-3 border font-semibold">AB-</td>
                                                                                  <td className="py-2 px-3 border text-center bg-green-100">O-</td>
                                                                                  <td className="py-2 px-3 border text-center bg-red-100">O+</td>
                                                                                  <td className="py-2 px-3 border text-center bg-green-100">A-</td>
                                                                                  <td className="py-2 px-3 border text-center bg-red-100">A+</td>
                                                                                  <td className="py-2 px-3 border text-center bg-green-100">B-</td>
                                                                                  <td className="py-2 px-3 border text-center bg-red-100">B+</td>
                                                                                  <td className="py-2 px-3 border text-center bg-green-100">AB-</td>
                                                                                  <td className="py-2 px-3 border text-center bg-red-100">AB+</td>
                                                                                </tr>
                                                                                <tr>
                                                                                  <td className="py-2 px-3 border font-semibold">AB+</td>
                                                                                  <td className="py-2 px-3 border text-center bg-green-100">O-</td>
                                                                                  <td className="py-2 px-3 border text-center bg-green-100">O+</td>
                                                                                  <td className="py-2 px-3 border text-center bg-green-100">A-</td>
                                                                                  <td className="py-2 px-3 border text-center bg-green-100">A+</td>
                                                                                  <td className="py-2 px-3 border text-center bg-green-100">B-</td>
                                                                                  <td className="py-2 px-3 border text-center bg-green-100">B+</td>
                                                                                  <td className="py-2 px-3 border text-center bg-green-100">AB-</td>
                                                                                  <td className="py-2 px-3 border text-center bg-green-100">AB+</td>
                                                                                </tr>
                                                                              </tbody>
                                                                            </table>
                                                                          </div>
                                                                          <p className="mt-2 text-sm text-gray-600">Green cells indicate compatible blood types. AB+ recipients can receive from any donor, while O- donors can donate to any recipient.</p>
                                                                        </div>
                                                                      </div>
                                                                    )}
      
      {/* Reference Section */}
      <div className="text-xs text-gray-500 mt-6 pt-4 border-t">
        <p><strong>Reference:</strong> Kransdorf et al. "Predicted heart mass is the optimal metric for size match in heart transplantation." The Journal of Heart and Lung Transplantation 38.2 (2019): 156-165.</p>
        <p className="mt-1">This application implements the PHM calculations and risk thresholds described in this research.</p>
        <p className="mt-3 text-red-600 font-semibold">IMPORTANT: This tool is for educational and research purposes only. Clinical decisions should always be made by qualified healthcare professionals.</p>
      </div>
    </div>
  );
};

export default HeartTransplantMatcher;
