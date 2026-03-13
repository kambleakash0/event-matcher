import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Simple demo login (replace with Firebase Auth later)
  const handleLogin = (e) => {
    e.preventDefault();
    
    // Demo credentials
    if (email === 'admin@aialliance.org' && password === 'admin123') {
      localStorage.setItem('isLoggedIn', 'true');
      navigate('/admin/dashboard');
    } else {
      setError('Invalid credentials. Use admin@aialliance.org / admin123');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <span className="login-logo">⚡</span>
          <h1>Admin Portal</h1>
          <p>Sign in to manage events</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@aialliance.org"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="login-btn">Sign In</button>
        </form>

        <div className="login-footer">
          <a href="/">← Back to Home</a>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;