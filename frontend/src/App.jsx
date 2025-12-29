
import './App.css'
import axios from "axios";

function App() {

  return (
    <>
      <div>
        <h1>Login</h1>
        <button onClick={handleGoogleLogin}>Sign in with Google</button>
      </div>
    </>
  )
}

export default App
