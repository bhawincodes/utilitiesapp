import React, { useState, useEffect, useRef } from 'react';

const TimerSelector = () => {
  const [selectedMinutes, setSelectedMinutes] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const minuteOptions = [1, 15, 20, 30, 40];

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Helper to send notifications with fallbacks and permission handling
  const sendNotification = (title, options = {}) => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      window.alert(title + (options.body ? `\n${options.body}` : ''));
      return;
    }

    const show = () => {
      try {
        new Notification(title, options);
      } catch (err) {
        // Some environments may throw — fallback to alert
        // eslint-disable-next-line no-console
        console.error('Notification show failed:', err);
        window.alert(title + (options.body ? `\n${options.body}` : ''));
      }
    };

    if (Notification.permission === 'granted') {
      show();
      return;
    }

    if (Notification.permission === 'denied') {
      // user explicitly denied; show fallback
      window.alert(title + (options.body ? `\n${options.body}` : ''));
      return;
    }

    // permission is 'default' — request it and then show if granted
    try {
      const permResult = Notification.requestPermission();
      if (permResult && typeof permResult.then === 'function') {
        permResult.then(perm => {
          if (perm === 'granted') show();
          else window.alert(title + (options.body ? `\n${options.body}` : ''));
        }).catch(() => {
          window.alert(title + (options.body ? `\n${options.body}` : ''));
        });
      } else {
        // Older callback style
        Notification.requestPermission(function (perm) {
          if (perm === 'granted') show();
          else window.alert(title + (options.body ? `\n${options.body}` : ''));
        });
      }
    } catch (err) {
      // If requestPermission throws for some reason, fallback
      // eslint-disable-next-line no-console
      console.error('requestPermission failed:', err);
      window.alert(title + (options.body ? `\n${options.body}` : ''));
    }
  };

  // Prevent duplicate notifications: use a ref to mark when we've already notified for
  // the current timer run. Also only recreate the interval when `isRunning` changes
  // (not on every `secondsLeft` change) to avoid overlapping intervals.
  const notifiedRef = useRef(false);

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            // ensure we notify only once per run
            if (!notifiedRef.current) {
              notifiedRef.current = true;
              sendNotification('Work Timer Complete!', {
                body: 'Your work session is done. Time for a break!'
              });
            }
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleSelectMinutes = (minutes) => {
    setSelectedMinutes(minutes);
    setSecondsLeft(minutes * 60);
    // reset notification guard for a fresh run
    if (typeof notifiedRef !== 'undefined') notifiedRef.current = false;
    setIsRunning(false);
  };

  const handleStart = () => {
    if (selectedMinutes !== null) {
      // Try to get notification permission on user gesture (required in some browsers)
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
      // reset notification guard when starting
      if (typeof notifiedRef !== 'undefined') notifiedRef.current = false;
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
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h3 style={{ margin: '0 0 20px 0', textAlign: 'center' }}>Select Timer Duration</h3>

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
