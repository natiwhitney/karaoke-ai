import React, { useEffect, useState } from 'react';

const ArtistPage = ({ artistName, onSongSelect, onBack }) => {
    const [songs, setSongs] = useState([]);
  
    useEffect(() => {
      fetch('http://127.0.0.1:8000/api/library')
        .then((response) => response.json())
        .then((data) => {
          const artist = data.library.find((artist) => artist.name === artistName);
          setSongs(artist?.children || []);
        })
        .catch((error) => console.error('Error fetching artist data:', error));
    }, [artistName]);
  
    return (
      <div>
        <div className="flex items-center mb-4">
          <button onClick={onBack} className="mr-4 bg-gray-100 p-2 rounded-lg">
            Back
          </button>
          <h1 className="text-2xl font-bold">{artistName}</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {songs.map((song, index) => (
            <div
              key={index}
              className="bg-white shadow-lg p-4 rounded-lg cursor-pointer"
              onClick={() => onSongSelect(song.name)}
            >
              <h2 className="text-xl font-semibold">{song.name}</h2>
            </div>
          ))}
        </div>
      </div>
    );
  };

export default ArtistPage;
