import React from 'react';
import Sidebar from '../components/Sidebar';
import OCR from '../components/OCR';
import './OCRPage.css';

const OCRPage = () => {
  return (
    <div className="layout-container">
      <Sidebar />
      
      <div className="main-content">
        <header className="content-header">
          <h1>Detección OCR de Planogramas</h1>
        </header>
        
        <div className="ocr-page-content">
          <OCR />
        </div>
      </div>
    </div>
  );
};

export default OCRPage; 