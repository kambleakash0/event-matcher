import { useState } from 'react';
import Papa from 'papaparse';

function CSVUploader({ label, onDataParsed }) {
  const [fileName, setFileName] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        onDataParsed(results.data);
      },
      error: (error) => {
        console.error('CSV parsing error:', error);
      }
    });
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label>{label}</label>
      <input type="file" accept=".csv" onChange={handleFileChange} />
      {fileName && <p>Loaded: {fileName}</p>}
    </div>
  );
}

export default CSVUploader;