"use client";

import { useState, useEffect, useCallback } from "react";
import { useMarketplaceClient } from "@/src/utils/hooks/useMarketplaceClient";

interface JsonTableData {
  data: string[][];
  metadata?: {
    rows: number;
    columns: number;
    source: string;
  };
}

export default function TableSelection() {
  const { client, isInitialized } = useMarketplaceClient();
  const [jsonData, setJsonData] = useState<JsonTableData | null>(null);
  const [textInput, setTextInput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const parseTextToJson = (text: string): JsonTableData => {
    // Split by lines and then by tabs or commas
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const rows = lines.map(line => {
      // Try tab first, then comma
      if (line.includes('\t')) {
        return line.split('\t').map(cell => cell.trim());
      } else {
        return line.split(',').map(cell => cell.trim());
      }
    });

    // Create JSON structure
    const jsonData: JsonTableData = {
      data: rows,
      metadata: {
        rows: rows.length,
        columns: rows[0]?.length || 0,
        source: "clipboard"
      }
    };

    return jsonData;
  };

  const handleTextChange = useCallback((text: string) => {
    setError(null);
    setHasChanges(true);

    if (!text.trim()) {
      setTextInput("");
      setJsonData(null);
      return;
    }

    try {
      let jsonData: JsonTableData;

      // Check if the input is already JSON
      if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
        try {
          // Try to parse as existing JSON
          const parsed = JSON.parse(text);
          if (parsed.data && Array.isArray(parsed.data)) {
            jsonData = parsed;
          } else {
            throw new Error("Invalid JSON structure");
          }
        } catch (parseError) {
          // If JSON parsing fails, treat as raw table data
          console.log("JSON parsing failed, treating as raw table data " + parseError);
          jsonData = parseTextToJson(text);
        }
      } else {
        // Convert raw text to JSON format
        jsonData = parseTextToJson(text);
      }
      
      if (jsonData.data.length === 0) {
        setError("No valid table data found");
        setTextInput("");
        setJsonData(null);
        return;
      }

      // Update text input to show JSON representation
      const jsonString = JSON.stringify(jsonData, null, 2);
      setTextInput(jsonString);
      setJsonData(jsonData);
    } catch (err) {
      setError(`Failed to parse data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTextInput("");
      setJsonData(null);
    }
  }, []);

  // Load existing data from client.getValue when component mounts
  useEffect(() => {
    if (isInitialized && client) {
      const loadExistingData = async () => {
        try {
          const existingData = await client.getValue();
          if (existingData && typeof existingData === 'string' && existingData.trim()) {
            // Try to parse the existing data as JSON
            try {
              const parsedData = JSON.parse(existingData);
              if (parsedData.data && Array.isArray(parsedData.data)) {
                // Valid JSON structure, set it directly
                setJsonData(parsedData);
                setTextInput(existingData);
                setHasChanges(false); // No changes yet since we just loaded
              } else {
                throw new Error("Invalid data structure");
              }
            } catch (parseError) {
              // If parsing fails, treat as raw text and convert it
              console.log("Failed to parse existing data as JSON, converting:", parseError);
              handleTextChange(existingData);
              setHasChanges(false); // No changes yet since we just loaded
            }
          }
        } catch (error) {
          console.error("Failed to load existing data:", error);
          // Don't set error state here since this is just loading existing data
          // The component can still function normally without pre-existing data
        }
      };

      loadExistingData();
    }
  }, [isInitialized, client, handleTextChange]);

  const handleClear = () => {
    setTextInput("");
    setJsonData(null);
    setError(null);
    setHasChanges(true);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    handleTextChange(pastedText);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Prevent all typing except Ctrl+A (select all), Ctrl+C (copy), Ctrl+V (paste), Ctrl+X (cut)
    //const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft with Ctrl', 'ArrowRight with Ctrl', 'ArrowUp with Ctrl', 'ArrowDown with Ctrl'];
    
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === 'a' || key === 'c' || key === 'v' || key === 'x') {
        return; // Allow these keyboard shortcuts
      }
    }
    
    // Block all other key presses except clearing the textarea
    e.preventDefault();
  };

  const handleSave = () => {
    if (!client) {
      setError("Client not initialized");
      return;
    }

    setIsSaving(true);

    try {
      // If jsonData is null (text box is empty), save empty string
      // Otherwise save the JSON data
      const dataToSave = jsonData ? JSON.stringify(jsonData) : "";
      client.setValue(dataToSave, true);
      setError(null);
      setHasChanges(false);
      
      // Close the app after 1 second
      setTimeout(() => client?.closeApp(), 500);
    } catch (err) {
      setIsSaving(false);
      setError(`Failed to save data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (!isInitialized) {
    return <div>Initializing...</div>;
  }

  return (
    <div style={{ 
      padding: "10px", 
      fontFamily: "Arial, sans-serif",
      display: "flex",
      flexDirection: "column",
      minHeight: "calc(100vh - 50px)"
    }}>
      {/* Main Content Area */}
      <div style={{ flex: 1 }}>
        {/* Text Input Area */}
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="table-input" style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
            Paste your table data here:
          </label>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <textarea
              id="table-input"
              value={textInput}
              readOnly={true}
              onPaste={handlePaste}
              onKeyDown={handleKeyPress}
              placeholder="Paste your table data here (tab-separated or comma-separated)... The JSON representation will appear automatically. You cannot type in this field - paste only."
              style={{
                width: "100%",
                height: "60px",
                padding: "12px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "14px",
                fontFamily: "monospace",
                resize: "vertical",
                fontStyle: "italic"
              }}
            />
            <button
              onClick={handleClear}
              style={{
                padding: "12px 16px",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                whiteSpace: "nowrap",
                height: "fit-content"
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            style={{
              padding: "12px 32px",
              backgroundColor: "#6E3FFF",
              color: "white",
              border: "none",
              borderRadius: "25px",
              cursor: (hasChanges && !isSaving) ? "pointer" : "not-allowed",
              fontSize: "16px",
              fontWeight: "500",
              fontFamily: "Arial, sans-serif",
              minWidth: "120px",
              opacity: (hasChanges && !isSaving) ? 1 : 0.5
            }}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div style={{ 
            color: "red", 
            backgroundColor: "#ffe6e6", 
            padding: "10px", 
            borderRadius: "4px",
            marginBottom: "20px"
          }}>
            {error}
          </div>
        )}

        {/* Table */}
        {jsonData && (
          <div style={{ 
            flex: 1,
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{ 
              overflow: "auto", 
              border: "1px solid #ccc", 
              borderRadius: "4px",
              flex: 1,
              backgroundColor: "white"
            }}>
              <table style={{ 
                width: "100%", 
                borderCollapse: "collapse",
                backgroundColor: "white",
                minWidth: "100%"
              }}>
                <tbody>
                  {jsonData.data.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            textAlign: "left",
                            backgroundColor: rowIndex === 0 ? "#f5f5f5" : "white",
                            whiteSpace: "nowrap",
                            minWidth: "100px"
                          }}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: "14px", color: "#666", marginTop: "10px", textAlign: "center" }}>
              Total rows: {jsonData.metadata?.rows || jsonData.data.length} | Total columns: {jsonData.metadata?.columns || jsonData.data[0]?.length || 0}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
