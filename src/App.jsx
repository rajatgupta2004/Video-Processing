import React, { useState, useRef, useEffect } from 'react';
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
    const [roi, setRoi] = useState('');
    const [selectedPoint, setSelectedPoint] = useState('');
    const [file, setFile] = useState(null);
    const [videoLoaded, setVideoLoaded] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [drawing, setDrawing] = useState(false);
    const [rect, setRect] = useState({ x: 0, y: 0, w: 0, h: 0 });
    const [mode, setMode] = useState(''); // New state to differentiate between drawing ROI and selecting point


    useEffect(() => {
        if (videoRef.current && canvasRef.current && file) {
            const context = canvasRef.current.getContext('2d');
            const video = videoRef.current;
    
            video.src = URL.createObjectURL(file);
            video.onloadeddata = () => {
                setVideoLoaded(true);
                const middleFrameTime = video.duration / 2;
                video.currentTime = middleFrameTime;
            };
    
            video.onseeked = () => {
                context.drawImage(video, 0, 0, canvasRef.current.width, canvasRef.current.height);
            };
        }
    }, [file]);
    

    const handleFileUpload = (event) => {
        event.preventDefault();
        setFile(event.target.files[0]);
        setVideoLoaded(false);
        setRoi('');
        setSelectedPoint('');
        setRect({ x: 0, y: 0, w: 0, h: 0 });
    };

    const handleMouseDown = (event) => {
        if (!videoLoaded) return;
        if (mode === 'drawing') {
            const rect = canvasRef.current.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            setRect({ x, y, w: 0, h: 0 });
            setDrawing(true);
        }
    };

    const handleMouseMove = (event) => {
        if (!drawing) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        setRect((prev) => ({ ...prev, w: x - prev.x, h: y - prev.y }));
    };

    const handleMouseUp = () => {
        setDrawing(false);
        if (mode === 'drawing') {
            setRoi(`${Math.floor(rect.x)},${Math.floor(rect.y)},${Math.floor(rect.w)},${Math.floor(rect.h)}`);
        }
    };

    const handleCanvasClick = (event) => {
        if (!videoLoaded || drawing) return;  // Check if currently drawing ROI rectangle
        if (mode === 'point') {
            const rectBounds = canvasRef.current.getBoundingClientRect();
            const x = event.clientX - rectBounds.left;
            const y = event.clientY - rectBounds.top;
            // Ensure the point is within the ROI rectangle
            if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
                setSelectedPoint(`${Math.floor(x)},${Math.floor(y)}`);
            }
        }
    };

    useEffect(() => {
        if (canvasRef.current && videoLoaded) {
            const context = canvasRef.current.getContext('2d');
            context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

            // Draw ROI rectangle
            if (rect.w && rect.h) {
                context.strokeStyle = 'red';
                context.strokeRect(rect.x, rect.y, rect.w, rect.h);
            }

            // Draw selected point
            if (selectedPoint) {
                const [pointX, pointY] = selectedPoint.split(',').map(Number);
                context.fillStyle = 'blue';
                context.beginPath();
                context.arc(pointX, pointY, 5, 0, 2 * Math.PI);
                context.fill();
            }
        }
    }, [rect, selectedPoint, videoLoaded]);

    const handleAnalyze = () => {
        if (!file) {
            setResponse('Please upload a video first.');
            return;
        }
        if (!roi || !selectedPoint) {
            setResponse('Please select the ROI and intensity point.');
            return;
        }
        const formData = new FormData();
        formData.append('video', file);
        formData.append('roi', roi);
        formData.append('selected_point', selectedPoint);
        console.log(roi);
        console.log(selectedPoint);
        

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
            <canvas
                ref={canvasRef}
                width="640"
                height="480"
                className="video-frame mt-3"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onClick={handleCanvasClick}
            ></canvas>
            <video ref={videoRef} style={{ display: 'none' }}></video>
            <div className="button-container mt-3">
                <button className="btn btn-secondary" onClick={() => setMode('drawing')}>Select ROI</button>
                <button className="btn btn-secondary" onClick={() => setMode('point')}>Select Intensity Point</button>
            </div>
            <button className="btn btn-primary mt-3" onClick={handleAnalyze}>Analyze</button>
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
