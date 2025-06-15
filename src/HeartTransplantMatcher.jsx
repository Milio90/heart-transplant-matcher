// HeartTransplantMatcher.jsx - Complete version with blood type support and PDF fixes
import React, { useState, useRef } from 'react';
import ExcelJS from 'exceljs';

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
  const resultsTableRef = useRef(null);

  // Available blood types
  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  
  // Extract ABO type from full blood type (ignore Rhesus for compatibility)
  const getABOType = (bloodType) => {
    if (!bloodType) return null;
    const aboType = bloodType.replace(/[+-]/, ''); // Remove + or -
    return ['A', 'B', 'AB', 'O'].includes(aboType) ? aboType : null;
  };
  
  // Check if Rhesus types are mismatched
  const hasRhesusMismatch = (donorBloodType, recipientBloodType) => {
    if (!donorBloodType || !recipientBloodType) return false;
    
    const donorRhesus = donorBloodType.includes('+') ? '+' : '-';
    const recipientRhesus = recipientBloodType.includes('+') ? '+' : '-';
    
    // Rh- recipient receiving Rh+ blood is problematic
    return recipientRhesus === '-' && donorRhesus === '+';
  };
  
  // Updated blood type compatibility chart (ABO only)
  const aboCompatibility = {
    'A': ['A', 'O'],
    'B': ['B', 'O'],
    'AB': ['A', 'B', 'AB', 'O'],
    'O': ['O']
  };
  
  // Check ABO compatibility only
  const isABOCompatible = (donorBloodType, recipientBloodType) => {
    const donorABO = getABOType(donorBloodType);
    const recipientABO = getABOType(recipientBloodType);
    
    if (!donorABO || !recipientABO) return false;
    return aboCompatibility[recipientABO]?.includes(donorABO) || false;
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
    
    // Check for required columns (updated list)
    const requiredColumns = ['dateadded', 'id', 'name', 'gender', 'age', 'height', 'weight', 'status'];
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
        
        // Special handling for date column
        if (header === 'dateadded') {
          // Handle Excel date format
          if (cell.value instanceof Date) {
            rowData[header] = cell.value;
          } else if (typeof cell.value === 'number') {
            // Excel date serial number
            rowData[header] = new Date((cell.value - 25569) * 86400 * 1000);
          } else {
            // Try to parse as string date
            rowData[header] = new Date(cell.value);
          }
        } else {
          rowData[header] = cell.value;
        }
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
    
    // Track Rhesus warnings
    let rhesusWarnings = 0;
    
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
      
      // Check ABO compatibility and Rhesus mismatch
      const aboMatch = isABOCompatible(donor.bloodType, recipient.bloodType);
      const rhesusWarning = hasRhesusMismatch(donor.bloodType, recipient.bloodType);
      
      if (rhesusWarning) rhesusWarnings++;
      
      return {
        ...recipient,
        donorPHM,
        recipientPHM,
        phmRatio,
        matchCategory,
        riskLevel,
        aboMatch,
        rhesusWarning,
        // Parse status as number
        status: parseInt(recipient.status) || 7,
        // Ensure dateAdded is a Date object
        dateAdded: recipient.dateadded instanceof Date ? recipient.dateadded : new Date(recipient.dateadded)
      };
    });
    
    // Sort by: PHM risk level → ABO compatibility → Status → Date added
    const sortedResults = [...results].sort((a, b) => {
      // 1. Risk level (Acceptable first)
      if (a.riskLevel !== b.riskLevel) {
        return a.riskLevel === 'Acceptable' ? -1 : 1;
      }
      
      // 2. ABO blood type compatibility
      if (a.aboMatch !== b.aboMatch) {
        return a.aboMatch ? -1 : 1;
      }
      
      // 3. Patient status (lower number = higher priority)
      if (a.status !== b.status) {
        return a.status - b.status;
      }
      
      // 4. Date added (older dates first)
      return a.dateAdded - b.dateAdded;
    });
    
    setMatchResults(sortedResults);
    
    // Show Rhesus warning if applicable
    if (rhesusWarnings > 0) {
      setError(`Warning: ${rhesusWarnings} recipient(s) have Rhesus incompatibility (Rh- recipient with Rh+ donor). Consider these matches carefully.`);
    }
    
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
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Heart Transplant Match Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
            table { border-collapse: collapse; width: 100%; margin: 10px 0; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background-color: #4285F4; color: white; font-size: 10px; }
            .high-risk { background-color: #fecaca; color: #991b1b; }
            .acceptable { background-color: #bbf7d0; color: #166534; }
            .priority-high { color: #dc2626; font-weight: bold; }
            .priority-medium { color: #ea580c; font-weight: bold; }
            .priority-low { color: #16a34a; }
          </style>
        </head>
        <body>
          <h1>Heart Transplant Match Report</h1>
          <p><strong>Donor:</strong> ${donor.name}</p>
          <p><strong>Details:</strong> ${donor.gender}, Age: ${donor.age}, Blood Type: ${donor.bloodType}</p>
          <p><strong>Physical:</strong> Height: ${donor.height}cm, Weight: ${donor.weight}kg</p>
          <p><strong>Donor PHM:</strong> ${matchResults[0].donorPHM.toFixed(2)}g</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
          
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>ID</th>
                <th>Name</th>
                <th>Age</th>
                <th>Date Added</th>
                <th>Status</th>
                <th>Blood Type</th>
                <th>ABO Match</th>
                <th>Rh Warn</th>
                <th>PHM Ratio</th>
                <th>Risk Level</th>
              </tr>
            </thead>
            <tbody>
              ${matchResults.map((result, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${result.id}</td>
                  <td>${result.name}</td>
                  <td>${result.age}</td>
                  <td>${result.dateAdded.toLocaleDateString()}</td>
                  <td class="${result.status <= 2 ? 'priority-high' : result.status <= 4 ? 'priority-medium' : 'priority-low'}">${result.status}</td>
                  <td>${result.bloodType || "Unknown"}</td>
                  <td>${result.aboMatch ? "✓" : "✗"}</td>
                  <td>${result.rhesusWarning ? "⚠" : "-"}</td>
                  <td>${result.phmRatio.toFixed(2)}</td>
                  <td class="${result.riskLevel === 'High Risk' ? 'high-risk' : 'acceptable'}">${result.riskLevel}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <h3>Sorting Criteria (in order of priority):</h3>
          <ol>
            <li>PHM Risk Level (Acceptable first)</li>
            <li>ABO Blood Type Compatibility</li>
            <li>Patient Status (1=highest priority)</li>
            <li>Date Added to List (oldest first)</li>
          </ol>
          
          <h3>Risk Categories:</h3>
          <p><strong>High Risk:</strong> PHM ratio < 0.86</p>
          <p><strong>Acceptable:</strong> PHM ratio ≥ 0.86</p>
          
          <h3>Status Levels:</h3>
          <p><strong>1-2:</strong> Critical priority | <strong>3-4:</strong> High priority | <strong>5-7:</strong> Standard priority</p>
          
          <p><strong>Note:</strong> ⚠ indicates Rhesus incompatibility (Rh- recipient with Rh+ donor)</p>
          
          <p style="margin-top: 15px; font-size: 10px;"><em>Based on: Kransdorf et al. "Predicted heart mass is the optimal metric for size match in heart transplantation" (2019)</em></p>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);
    
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
        <p className="mb-3 text-sm text-gray-600">
          Upload an Excel file (.xlsx) containing recipient information with columns: 
          dateAdded, id, name, gender, age, height (cm), weight (kg), bloodType, status (1-7)
        </p>
        <div className="mb-2 text-xs text-gray-500">
          <strong>Column details:</strong><br/>
          • dateAdded: Date patient was added to waiting list<br/>
          • status: Priority level (1=highest priority, 7=lowest priority)<br/>
          • bloodType: Include Rh factor (e.g., A+, B-, O+, AB-)
        </div>
        
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
            <table ref={resultsTableRef} className="min-w-full bg-white border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-2 px-4 border">Rank</th>
                  <th className="py-2 px-4 border">ID</th>
                  <th className="py-2 px-4 border">Name</th>
                  <th className="py-2 px-4 border">Date Added</th>
                  <th className="py-2 px-4 border">Status</th>
                  <th className="py-2 px-4 border">Gender</th>
                  <th className="py-2 px-4 border">Blood Type</th>
                  <th className="py-2 px-4 border">ABO Compatible</th>
                  <th className="py-2 px-4 border">Rh Warning</th>
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
                    <td className="py-2 px-4 border">{result.dateAdded.toLocaleDateString()}</td>
                    <td className="py-2 px-4 border text-center font-semibold" style={{
                      color: result.status <= 2 ? '#dc2626' : result.status <= 4 ? '#ea580c' : '#16a34a'
                    }}>
                      {result.status}
                    </td>
                    <td className="py-2 px-4 border">{result.gender}</td>
                    <td className="py-2 px-4 border">{result.bloodType || "Unknown"}</td>
                    <td className="py-2 px-4 border text-center font-bold">
                      {result.aboMatch ? 
                        <span style={{color: '#16a34a'}}>✓</span> : 
                        <span style={{color: '#dc2626'}}>✗</span>
                      }
                    </td>
                    <td className="py-2 px-4 border text-center">
                      {result.rhesusWarning ? 
                        <span style={{color: '#ea580c'}}>⚠</span> : 
                        <span style={{color: '#6b7280'}}>-</span>
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
                    <li><strong>Results sorting:</strong> PHM risk level first, then ABO compatibility, then patient status, then date added</li>
                  </ul>
                </div>
                
    {/* Blood type compatibility chart */}
    <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
      <h3 className="font-semibold mb-2">ABO Blood Type Compatibility Chart:</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border mt-2">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-3 border">Recipient ABO Type</th>
              <th className="py-2 px-3 border text-center" colSpan="4">Compatible Donor ABO Types</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-2 px-3 border font-semibold">O</td>
              <td className="py-2 px-3 border text-center bg-green-100">O</td>
              <td className="py-2 px-3 border text-center bg-red-100">A</td>
              <td className="py-2 px-3 border text-center bg-red-100">B</td>
              <td className="py-2 px-3 border text-center bg-red-100">AB</td>
            </tr>
            <tr>
              <td className="py-2 px-3 border font-semibold">A</td>
              <td className="py-2 px-3 border text-center bg-green-100">O</td>
              <td className="py-2 px-3 border text-center bg-green-100">A</td>
              <td className="py-2 px-3 border text-center bg-red-100">B</td>
              <td className="py-2 px-3 border text-center bg-red-100">AB</td>
            </tr>
            <tr>
              <td className="py-2 px-3 border font-semibold">B</td>
              <td className="py-2 px-3 border text-center bg-green-100">O</td>
              <td className="py-2 px-3 border text-center bg-red-100">A</td>
              <td className="py-2 px-3 border text-center bg-green-100">B</td>
              <td className="py-2 px-3 border text-center bg-red-100">AB</td>
            </tr>
            <tr>
              <td className="py-2 px-3 border font-semibold">AB</td>
              <td className="py-2 px-3 border text-center bg-green-100">O</td>
              <td className="py-2 px-3 border text-center bg-green-100">A</td>
              <td className="py-2 px-3 border text-center bg-green-100">B</td>
              <td className="py-2 px-3 border text-center bg-green-100">AB</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-gray-600">
        Green cells indicate ABO-compatible types. Rhesus factor warnings are shown separately.
        AB recipients can receive from any ABO type, while O recipients can only receive from O donors.
      </p>
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
