import React, { useState, useEffect, useRef } from 'react';
import './TimerSelector.css';
import apiservice from './../../../lib/apiService.jsx';

const TimerSelector = () => {
  const [selectedMinutes, setSelectedMinutes] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [currentSecondsDone, setCurrentSecondsDone] = useState(0);

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

  // Interval effect: only decrements secondsLeft
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setSecondsLeft(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  // Effect to handle timer completion and log time/notify ONCE
  useEffect(() => {
    if (isRunning && secondsLeft === 0 && !notifiedRef.current) {
      notifiedRef.current = true;
      sendNotification('Work Timer Complete!', {
        body: 'Your work session is done. Time for a break!'
      });
      apiservice.logTime(selectedMinutes * 60); // Log the full time spent
      setCurrentSecondsDone(0);
      setIsRunning(false);
    }
  }, [isRunning, secondsLeft, selectedMinutes]);

  const handleSelectMinutes = (minutes) => {
    setSelectedMinutes(minutes);
    setSecondsLeft(minutes * 60);
    setCurrentSecondsDone(0);
    // reset notification guard for a fresh run
    if (typeof notifiedRef !== 'undefined') notifiedRef.current = false;
    setIsRunning(false);
  };

  const handleStart = () => {
      if(secondsLeft === 0) {
        setSecondsLeft(selectedMinutes * 60);
      }
      setIsRunning(true);
  };

  const handlePause = () => {
    const secondsDone = selectedMinutes * 60 - secondsLeft - currentSecondsDone;
    setCurrentSecondsDone(prev => prev + secondsDone);
    apiservice.logTime(secondsDone); // Log the time spent so far
    setIsRunning(false);
  };

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };



  return (
    <div style={{ padding: '1.25rem', textAlign: 'center' }}>
      <h3 style={{ margin: '0 0 1.25rem 0', textAlign: 'center' }}>Select Timer Duration</h3>

      <div style={{ marginBottom: '1.25rem' }}>
        <select
          value={selectedMinutes || ''}
          onChange={(e) => handleSelectMinutes(Number(e.target.value))}
          className="timer-select"
        >
          <option value="">Choose minutes...</option>
          {minuteOptions.map(minute => (
            <option key={minute} value={minute}>{minute} minutes</option>
          ))}
        </select>
      </div>

      {selectedMinutes !== null && (
        <>
          <div
            className={`timer-display ${isRunning ? 'timer-display--running' : 'timer-display--stopped'}`}
          >
            {formatTime(secondsLeft)}
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <button
              onClick={handleStart}
              disabled={isRunning}
              className={`timer-btn-start${isRunning ? ' timer-btn-start--disabled' : ''}`}
            >
              Start
            </button>
            <button
              onClick={handlePause}
              disabled={!isRunning}
              className={`timer-btn-pause${!isRunning ? ' timer-btn-pause--disabled' : ''}`}
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
