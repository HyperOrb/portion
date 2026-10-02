import ReactDOM from 'react-dom/client';
import App from './App';
import AccountGate from './Account';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<AccountGate>{session => <App key={session?.user.id || 'device'} userId={session?.user.id} email={session?.user.email} />}</AccountGate>);
