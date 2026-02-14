
import React, { useEffect } from 'react';
import axios from "axios";
import { useDispatch, useSelector } from 'react-redux';
import { postUserProfile } from '../store/slices/userSlice';
import { getUserProfilePayload } from '../lib/userProfile';
import "./Home.css";



export default function Home() {
  const dispatch = useDispatch();
  const user = useSelector(state => state.user.user);

  const handleGoogleLogin = async () => {
    const res = await axios.get("http://localhost:8000/auth/google/url");
    window.location.href = res.data.url;
  };

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:8000/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res?.data) {
        const payload = getUserProfilePayload(res.data);
        dispatch(postUserProfile(payload));
      }
    } catch (error) {
      try {
        handleGoogleLogin();
      } catch (e) {
        window.location.reload();
      }
    }
  };

  useEffect(() => {
    if(localStorage.getItem("token"))
      fetchProfile();
  }, []);

  return (
    <div>
      <h1>Login</h1>
      {!user && (
        <button className="google" onClick={handleGoogleLogin}>Sign in with Google</button>
      )}
    </div>
  );
}
