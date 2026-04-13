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
    <div style={{ padding: '1.25rem', textAlign: 'center' }}>
      <h3 style={{ margin: '0 0 1.25rem 0', textAlign: 'center' }}>Select Timer Duration</h3>

      <div style={{ marginBottom: '1.25rem' }}>
        <select
          value={selectedMinutes || ''}
          onChange={(e) => handleSelectMinutes(Number(e.target.value))}
          style={{
            padding: '0.625rem 0.9375rem',
            fontSize: '1rem',
            borderRadius: '0.25rem',
            border: '0.125rem solid #ccc',
            cursor: 'pointer',
            minWidth: '9.375rem'
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
            fontSize: '3.5rem',
            fontWeight: 'bold',
            margin: '1.25rem 0',
            padding: '1.875rem',
            backgroundColor: timerColor,
            color: 'white',
            borderRadius: '0.5rem',
            fontFamily: 'monospace'
          }}>
            {formatTime(secondsLeft)}
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <button
              onClick={handleStart}
              disabled={isRunning}
              style={{
                padding: '0.625rem 1.25rem',
                fontSize: '1rem',
                marginRight: '0.625rem',
                backgroundColor: isRunning ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '0.25rem',
                cursor: isRunning ? 'not-allowed' : 'pointer'
              }}
            >
              Start
            </button>
            <button
              onClick={handlePause}
              disabled={!isRunning}
              style={{
                padding: '0.625rem 1.25rem',
                fontSize: '1rem',
                backgroundColor: !isRunning ? '#ccc' : '#FF9800',
                color: 'white',
                border: 'none',
                borderRadius: '0.25rem',
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
