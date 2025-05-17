import React, { useState, useRef } from 'react';
import './FileUpload.css';

const FileUpload = ({ onFileChange, previewUrl = null, className = '' }) => {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState(previewUrl);
  const fileInputRef = useRef(null);

  // Handle file selection from input
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Preview the image
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);
    
    // Pass the file to parent component
    onFileChange(file);
  };

  // Handle drag events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // Handle drop event
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      
      // Preview the image
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
      
      // Pass the file to parent component
      onFileChange(file);
    }
  };

  // Trigger file input click
  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  // Update preview if previewUrl prop changes
  React.useEffect(() => {
    if (previewUrl) {
      setPreview(previewUrl);
    }
  }, [previewUrl]);

  return (
    <div 
      className={`file-upload-container ${className} ${dragActive ? 'drag-active' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={onButtonClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="file-input"
        accept="image/*"
        onChange={handleFileChange}
      />
      
      {preview ? (
        <div className="preview-container">
          <img src={preview} alt="Preview" className="image-preview" />
        </div>
      ) : (
        <div className="upload-label">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
          </svg>
          <p>Arrastra una imagen o haz clic para subir</p>
        </div>
      )}
    </div>
  );
};

export default FileUpload; 