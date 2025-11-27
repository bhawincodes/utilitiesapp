import React, { useState, useEffect } from 'react';

const TimerSelector = () => {
  const [selectedMinutes, setSelectedMinutes] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const minuteOptions = [15, 20, 30, 40];

  useEffect(() => {
    let interval;
    if (isRunning && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, secondsLeft]);

  const handleSelectMinutes = (minutes) => {
    setSelectedMinutes(minutes);
    setSecondsLeft(minutes * 60);
    setIsRunning(false);
  };

  const handleStart = () => {
    if (selectedMinutes !== null) {
      setIsRunning(true);
    }
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timerColor = isRunning ? '#8B00FF' : '#00008B';

  return (
    <div style={{ padding: '20px', textAlign: 'center', marginTop: '30px' }}>
      <h3>Select Timer Duration</h3>

      <div style={{ marginBottom: '20px' }}>
        <select
          value={selectedMinutes || ''}
          onChange={(e) => handleSelectMinutes(Number(e.target.value))}
          style={{
            padding: '10px 15px',
            fontSize: '16px',
            borderRadius: '4px',
            border: '2px solid #ccc',
            cursor: 'pointer',
            minWidth: '150px'
          }}
        >
          <option value="">Choose minutes...</option>
          {minuteOptions.map(minute => (
            <option key={minute} value={minute}>{minute} minutes</option>
          ))}
        </select>
      </div>

      {selectedMinutes !== null && (
        <>
          <div style={{
            fontSize: '56px',
            fontWeight: 'bold',
            margin: '20px 0',
            padding: '30px',
            backgroundColor: timerColor,
            color: 'white',
            borderRadius: '8px',
            fontFamily: 'monospace'
          }}>
            {formatTime(secondsLeft)}
          </div>

          <div style={{ marginTop: '20px' }}>
            <button
              onClick={handleStart}
              disabled={isRunning}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                marginRight: '10px',
                backgroundColor: isRunning ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isRunning ? 'not-allowed' : 'pointer'
              }}
            >
              Start
            </button>
            <button
              onClick={handlePause}
              disabled={!isRunning}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: !isRunning ? '#ccc' : '#FF9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: !isRunning ? 'not-allowed' : 'pointer'
              }}
            >
              Pause
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default TimerSelector;
