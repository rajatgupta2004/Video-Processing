import React, { useState } from 'react';
import axios from 'axios';
import Chart from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';
import './App.css'; // Import the CSS file

Chart.register(zoomPlugin);

const App = () => {
    const [progress, setProgress] = useState(0);
    const [response, setResponse] = useState('');
    const [intensityData, setIntensityData] = useState([]);
    const [timeStamps, setTimeStamps] = useState([]);

    const handleFileUpload = (event) => {
        event.preventDefault();
        const file = event.target.files[0];
        const formData = new FormData();
        formData.append('video', file);

        axios.post('http://127.0.0.1:5000/upload', formData, {
            onUploadProgress: (progressEvent) => {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                setProgress(percentCompleted);
            }
        })
        .then((res) => {
            setResponse(res.data.message);
            setIntensityData(res.data.intensity_values);
            setTimeStamps(res.data.time_stamps);
            plotGraph(res.data.time_stamps, res.data.intensity_values);
        })
        .catch((err) => {
            setResponse('Error: ' + err.message);
        });
    };

    const plotGraph = (timeStamps, intensityValues) => {
        const ctx = document.getElementById('intensityChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeStamps,
                datasets: [{
                    label: 'Intensity over Time',
                    data: intensityValues,
                    borderColor: '#4A90E2', // Change border color
                    borderWidth: 3,
                    pointRadius: 0, // Remove point markers
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time (s)',
                            color: '#333', // Change axis title color
                        },
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Intensity (Brightness)',
                            color: '#333', // Change axis title color
                        },
                    },
                },
                plugins: {
                    zoom: {
                        pan: {
                            enabled: true,
                            mode: 'xy',
                        },
                        zoom: {
                            wheel: {
                                enabled: true,
                            },
                            pinch: {
                                enabled: true,
                            },
                            mode: 'xy',
                            limits: {
                                x: { min: 0, max: timeStamps[timeStamps.length - 1] },
                                y: { min: Math.min(...intensityValues), max: Math.max(...intensityValues) },
                            },
                            rangeMin: {
                                x: 0,
                                y: Math.min(...intensityValues),
                            },
                            rangeMax: {
                                x: timeStamps[timeStamps.length - 1],
                                y: Math.max(...intensityValues),
                            },
                            onZoomComplete: ({ chart }) => {
                                const zoomLevel = chart.getZoomLevel();
                                if (zoomLevel < 1) {
                                    chart.resetZoom();
                                }
                            },
                        },
                    },
                },
            },
        });
    };

    return (
        <div className="container mt-5 h-screen">
            <h1 className="title">Upload Video for Processing</h1>
            <input type="file" onChange={handleFileUpload} accept="video/*" className="form-control file-input" />
            <div className="progress mt-3" style={{ display: progress > 0 ? 'block' : 'none' }}>
                <div className="progress-bar" role="progressbar" style={{ width: `${progress}%` }} aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
                    {progress}%
                </div>
            </div>
            <div className="mt-3 response">{response}</div>
            <div className="mt-5 chart-container">
                <canvas id="intensityChart" className='chart'></canvas>
            </div>
        </div>
    );
};

export default App;
