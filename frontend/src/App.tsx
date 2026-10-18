import { useState, useEffect } from 'react'
import './App.css'

const API_BASE = 'http://localhost:3001/api';

function App() {
  const [serverCounter, setServerCounter] = useState<number>(0);
  const [notes, setNotes] = useState<string[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [healthStatus, setHealthStatus] = useState<string>('checking...');
  const [lastUpdate, setLastUpdate] = useState<string>('');

  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      const data = await res.json();
      setHealthStatus(`✓ Server OK (uptime: ${Math.floor(data.uptime)}s)`);
    } catch (err) {
      setHealthStatus('✗ Server Offline');
    }
  };

  const fetchCounter = async () => {
    try {
      const res = await fetch(`${API_BASE}/counter`);
      const data = await res.json();
      setServerCounter(data.counter);
    } catch (err) {
      console.error('Failed to fetch counter:', err);
    }
  };

  const incrementCounter = async () => {
    try {
      const res = await fetch(`${API_BASE}/counter/increment`, { method: 'POST' });
      const data = await res.json();
      setServerCounter(data.counter);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to increment:', err);
    }
  };

  const resetCounter = async () => {
    try {
      const res = await fetch(`${API_BASE}/counter/reset`, { method: 'POST' });
      const data = await res.json();
      setServerCounter(data.counter);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to reset:', err);
    }
  };

  const fetchNotes = async () => {
    try {
      const res = await fetch(`${API_BASE}/notes`);
      const data = await res.json();
      setNotes(data.notes);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    }
  };

  const addNote = async () => {
    if (!noteInput.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteInput })
      });
      const data = await res.json();
      setNotes(data.notes);
      setNoteInput('');
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to add note:', err);
    }
  };

  const clearNotes = async () => {
    try {
      const res = await fetch(`${API_BASE}/notes`, { method: 'DELETE' });
      const data = await res.json();
      setNotes(data.notes);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to clear notes:', err);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchCounter();
    fetchNotes();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-container">
      <header>
        <h1>MySL8TE Feature Lab</h1>
        <p className="subtitle">Environment Bootstrap Test Interface</p>
        <div className="health-status">{healthStatus}</div>
      </header>

      <main>
        <section className="test-section">
          <h2>Counter Test</h2>
          <div className="counter-display" data-testid="counter-display">
            Current Count: <strong>{serverCounter}</strong>
          </div>
          <div className="button-group">
            <button 
              onClick={incrementCounter} 
              className="btn-primary"
              data-testid="increment-button"
            >
              Increment Counter
            </button>
            <button 
              onClick={resetCounter} 
              className="btn-secondary"
              data-testid="reset-button"
            >
              Reset Counter
            </button>
            <button 
              onClick={fetchCounter} 
              className="btn-tertiary"
            >
              Refresh
            </button>
          </div>
        </section>

        <section className="test-section">
          <h2>Notes Test</h2>
          <div className="notes-input-group">
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addNote()}
              placeholder="Enter a note..."
              className="note-input"
              data-testid="note-input"
            />
            <button 
              onClick={addNote} 
              className="btn-primary"
              data-testid="add-note-button"
            >
              Add Note
            </button>
          </div>
          
          <div className="notes-list" data-testid="notes-list">
            {notes.length === 0 ? (
              <p className="empty-state">No notes yet. Add one above!</p>
            ) : (
              <ul>
                {notes.map((note, idx) => (
                  <li key={idx} data-testid={`note-${idx}`}>{note}</li>
                ))}
              </ul>
            )}
          </div>
          
          {notes.length > 0 && (
            <button 
              onClick={clearNotes} 
              className="btn-danger"
              data-testid="clear-notes-button"
            >
              Clear All Notes
            </button>
          )}
        </section>

        {lastUpdate && (
          <div className="last-update">
            Last update: {lastUpdate}
          </div>
        )}
      </main>

      <footer>
        <p>Test Environment Ready for Playwright Automation</p>
      </footer>
    </div>
  );
}

export default App
