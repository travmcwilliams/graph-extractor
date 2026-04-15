import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";

export default function UploadZone({ onExtract }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    const f = acceptedFiles[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [] },
    maxFiles: 1,
  });

  return (
    <div className="w-full max-w-lg">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input {...getInputProps()} />
        {preview ? (
          <img
            src={preview}
            alt="Preview"
            className="max-h-64 mx-auto rounded"
          />
        ) : (
          <p className="text-gray-500">
            {isDragActive
              ? "Drop the image here..."
              : "Drag & drop a circuit image, or click to select"}
          </p>
        )}
      </div>

      {file && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-gray-600 truncate">{file.name}</span>
          <button
            onClick={() => onExtract(file)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Extract
          </button>
        </div>
      )}
    </div>
  );
}
