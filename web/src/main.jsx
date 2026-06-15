//file path: web/src/main.jsx

import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AppContextProvider } from './context/AppContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import './index.css'
import App from './App.jsx'

// Exported so dedicated sign-in/sign-up pages can talk to GIS directly
// without going through the @react-oauth/google iframe widget.
export const GOOGLE_CLIENT_ID = "349956198148-fohnnk91p22dguilu4p1dgufsug5kh43.apps.googleusercontent.com";

createRoot(document.getElementById('root')).render(
	<BrowserRouter>
		<GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
			<ThemeProvider>
				<AppContextProvider>
					<App />
				</AppContextProvider>
			</ThemeProvider>
		</GoogleOAuthProvider>
	</BrowserRouter>
)














































