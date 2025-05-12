// HeartTransplantMatcher.jsx
import React, { useState, useEffect } from 'react';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const HeartTransplantMatcher = () => {
  const [recipients, setRecipients] = useState([]);
  const [donor, setDonor] = useState({
    name: '',
    gender: '',
    age: '',
    height: '',
    weight: ''
  });
  const [matchResults, setMatchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState(null);

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
      
      // Check for required columns
      const requiredColumns = ['id', 'name', 'gender', 'age', 'height', 'weight'];
      const missingColumns = requiredColumns.filter(col => !headers.includes(col));
      
      if (missingColumns.length) {
        setError(`Missing required columns: ${missingColumns.join(', ')}`);
        setIsLoading(false);
        return;
      }
      
      // Convert rows to JSON
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row
        
        const rowData = {};
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber - 1];
          rowData[header] = cell.value;
        });
        
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
      setError('Error processing file. Please ensure it is a valid Excel file.');
      console.error(err);
      setIsLoading(false);
    }
  };

  const handleDonorChange = (e) => {
    const { name, value } = e.target;
    setDonor(prev => ({ ...prev, [name]: value }));
  };

  const handleCalculateMatches = () => {
    // Validate donor data
    const donorFields = ['name', 'gender', 'age', 'height', 'weight'];
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
        // Validate recipient data
        const recipientPHM = calculatePHM(
          recipient.gender,
          parseFloat(recipient.age),
          parseFloat(recipient.height),
          parseFloat(recipient.weight)
        );
        
        const phmRatio = calculatePHMRatio(donorPHM, recipientPHM);
        const matchCategory = determineMatchCategory(phmRatio);
        const riskLevel = determineRiskLevel(phmRatio);
        
        return {
          ...recipient,
          donorPHM,
          recipientPHM,
          phmRatio,
          matchCategory,
          riskLevel
        };
      });
      
      // Sort by PHM ratio (closest to 1.0 is best)
      const sortedResults = [...results].sort((a, b) => {
        // First sort by risk level
        if (a.riskLevel !== b.riskLevel) {
          return a.riskLevel === 'Acceptable' ? -1 : 1;
        }
        
        // Then sort by how close the ratio is to 1.0
        return Math.abs(a.phmRatio - 1) - Math.abs(b.phmRatio - 1);
      });
      
      setMatchResults(sortedResults);
    } catch (err) {
      setError('Error calculating matches. Please check your data.');
      console.error(err);
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
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(16);
      doc.text('Heart Transplant Match Report', 14, 15);
      
      // Add donor info
      doc.setFontSize(12);
      doc.text(`Donor: ${donor.name}`, 14, 25);
      doc.text(`Gender: ${donor.gender}, Age: ${donor.age}, Height: ${donor.height}cm, Weight: ${donor.weight}kg`, 14, 32);
      doc.text(`Donor Predicted Heart Mass: ${matchResults[0].donorPHM.toFixed(2)}g`, 14, 39);
      
      // Add date
      const date = new Date().toLocaleDateString();
      doc.text(`Generated on: ${date}`, 14, 46);
      
      // Prepare table data
      const tableColumn = ["Rank", "Recipient ID", "Name", "PHM Ratio", "Match Category", "Risk Level"];
      const tableRows = matchResults.map((result, index) => [
        index + 1,
        result.id,
        result.name,
        result.phmRatio.toFixed(2),
        result.matchCategory,
        result.riskLevel
      ]);
      
      // Add the table
      doc.autoTable({
        startY: 55,
        head: [tableColumn],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [66, 139, 202] }
      });
      
      // Add information about risk categories
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.text('Risk Categories:', 14, finalY);
      doc.text('High Risk: PHM ratio < 0.86', 14, finalY + 7);
      doc.text('Acceptable: PHM ratio ≥ 0.86', 14, finalY + 14);
      
      // Add reference to research
      doc.text('Based on: Kransdorf et al. "Predicted heart mass is the optimal metric for size match in heart transplantation" (2019)', 14, finalY + 25);
      
      // Save PDF
      doc.save(`heart_transplant_match_report_${date.replace(/\//g, '-')}.pdf`);
      
    } catch (err) {
      setError('Error generating PDF');
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-blue-700">Heart Transplant Matching Tool</h1>
      
      {/* File Upload Section */}
      <div className="mb-8 p-4 border rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold mb-3">Step 1: Upload Recipient List</h2>
        <p className="mb-3 text-sm text-gray-600">Upload an Excel file (.xlsx) containing recipient information with columns: id, name, gender, age, height (cm), weight (kg)</p>
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
                  <tr key={index} className={result.riskLevel === 'High Risk' ? 'bg-red-50' : index % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="py-2 px-4 border text-center">{index + 1}</td>
                    <td className="py-2 px-4 border">{result.id}</td>
                    <td className="py-2 px-4 border">{result.name}</td>
                    <td className="py-2 px-4 border">{result.gender}</td>
                    <td className="py-2 px-4 border">{result.age}</td>
                    <td className="py-2 px-4 border">{result.recipientPHM.toFixed(2)}g</td>
                    <td className="py-2 px-4 border">{result.donorPHM.toFixed(2)}g</td>
                    <td className="py-2 px-4 border font-semibold">{result.phmRatio.toFixed(2)}</td>
                    <td className="py-2 px-4 border">{result.matchCategory}</td>
                    <td className={`py-2 px-4 border font-bold ${result.riskLevel === 'High Risk' ? 'text-red-600' : 'text-green-600'}`}>
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
              <li><strong>PHM (Predicted Heart Mass):</strong> Calculated using formulas from Kransdorf et al. research</li>
              <li><strong>High Risk:</strong> Donor-to-recipient PHM ratio &lt; 0.86</li>
              <li><strong>Optimal match:</strong> Donor-to-recipient PHM ratio between 0.983 and 1.039 (Well-Matched)</li>
              <li><strong>Results sorting:</strong> Prioritizes Acceptable risk, then sorts by closeness to optimal ratio (1.0)</li>
            </ul>
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
