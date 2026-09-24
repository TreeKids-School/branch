import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { applyOfficeTheme } from './utils/themeUtils'

// Apply initial office theme immediately from cached office to avoid color flash
applyOfficeTheme();


ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
