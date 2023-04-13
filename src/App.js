import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage';
import AddRecordPage from './components/AddRecordPage';
import AuthPage from './components/AuthPage';
import RegistrationForm from './components/RegistrationForm';
import LoginForm from './components/LoginForm';
import axios from 'axios';
import { Navigate } from 'react-router-dom';

function App() {
  const [records, setRecords] = useState([]);
  const [isLogin, setIsLogin] = useState(false);

  const socket = new WebSocket('ws://localhost:3001');

  const addRecord = record => {
    try {
      socket.addEventListener('open', (event) => {
        socket.send(JSON.stringify({
          type: 'addWeight',
          data: record
        }));
      });
      socket.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'added') {
          setRecords([...records, data.data]);
        } 
        if (data.type === 'addErr') {
        }
      });
    } catch (err) {
      console.log(err);
    }
  };

  const deleteRecord = id => {
    axios.delete(`/api/weights/${id}`)
      .then(res => setRecords(records.filter(record => record._id !== id)))
      .catch(err => console.log(err));
  };

  const register = (formData) => {
    try {
      socket.addEventListener('open', (event) => {
        socket.send(JSON.stringify({
          type: 'register',
          formData: formData
        }));
      });
    } catch (err) {
      console.log(err);
    }
  }

  const login = (formData) => {
    try {
      socket.addEventListener('open', (event) => {
        socket.send(JSON.stringify({
          type: 'login',
          formData: formData
        }));
      });
    } catch (err) {
      console.log(err);
    }
  }

  return (
    <div className="container">
    <Routes>        
        <Route path="/" element={<HomePage records={records} onDeleteRecord={deleteRecord} />} />
        <Route path="/add" element={<AddRecordPage onAddRecord={addRecord} />} />
        <Route path="/auth" element={<AuthPage onRegister={register} onLogin={login} />} />
        <Route path="/login" element={<LoginForm onLogin={login} handleSwitchToRegister={() => setIsLogin(false)} />} />
        <Route path="/register" element={<RegistrationForm onRegister={register} handleSwitchToLogin={() => setIsLogin(true)} />} />
        <Route path="*" element={<Navigate to='/auth' />} />
    </Routes>
    </div>
  );
}

export default App;