import React, { useEffect, useState } from 'react';
import { buildApiUrl } from '../config/api';


const LibraryDisplay = ({ onArtistSelect }) => {
    const [libraryData, setLibraryData] = useState([]);
  
    useEffect(() => {
      fetch(buildApiUrl('/library'))
        .then((response) => response.json())
        .then((data) => setLibraryData(data.library || []))
        .catch((error) => console.error('Error fetching library data:', error));
    }, []);
  
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Library</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {libraryData.map((artist, index) => (
            <div
              key={index}
              className="bg-white shadow-lg p-4 rounded-lg cursor-pointer"
              onClick={() => onArtistSelect(artist.name)}
            >
              <h2 className="text-xl font-semibold">{artist.name}</h2>
            </div>
          ))}
        </div>
      </div>
    );
  };
export default LibraryDisplay;
