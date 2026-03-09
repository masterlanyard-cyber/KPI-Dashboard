import GoogleSheetsProvider from './GoogleSheetsProvider';
import DashboardLayout from './DashboardLayout';

const SHEET_KEY = '1DPHuHqfYMUTQwflRD2FJiPVg1iClFjSfZcpQ9J9qiUg'; // sheetKey dari user
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';

function App() {
  return (
    <GoogleSheetsProvider sheetKey={SHEET_KEY} refreshIntervalMs={15000} apiBaseUrl={API_BASE_URL}>
        <DashboardLayout />
    </GoogleSheetsProvider>
  );
}

export default App;
