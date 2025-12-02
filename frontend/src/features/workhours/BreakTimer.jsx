import React, { useState, useEffect } from 'react';

const BreakTimer = () => {
  const [selectedMinutes, setSelectedMinutes] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const breakOptions = [1, 5, 10, 15, 20];

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    let interval;
    if (isRunning && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            // Send notification when timer completes. If permission isn't granted, try requesting it now.
            if ('Notification' in window) {
              if (Notification.permission === 'granted') {
                new Notification('Break Time Over!', {
                  body: 'Your break is complete. Time to get back to work!'
                });
              } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(perm => {
                  if (perm === 'granted') {
                    new Notification('Break Time Over!', {
                      body: 'Your break is complete. Time to get back to work!'
                    });
                  } else {
                    window.alert('Break time complete!');
                  }
                }).catch(() => {
                  window.alert('Break time complete!');
                });
              } else {
                window.alert('Break time complete!');
              }
            } else {
              window.alert('Break time complete!');
            }
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
      // Try to get notification permission on user gesture (required in some browsers)
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
      setIsRunning(true);
    }
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setSelectedMinutes(null);
    setIsRunning(false);
    setSecondsLeft(0);
  };

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timerColor = isRunning ? '#FF6B6B' : '#DC3545';

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h3 style={{ margin: '0 0 20px 0', textAlign: 'center' }}>Break Time Timer</h3>

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
          <option value="">Choose break time...</option>
          {breakOptions.map(minute => (
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

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={handleStart}
              disabled={isRunning}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
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
            <button
              onClick={handleReset}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Reset
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default BreakTimer;
