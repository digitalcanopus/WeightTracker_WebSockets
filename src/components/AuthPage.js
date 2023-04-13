import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from 'react-modal';
import RegistrationForm from './RegistrationForm';
import LoginForm from './LoginForm';

const AuthPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const socket = new WebSocket('ws://localhost:3001');
  const navigate = useNavigate();

  const handleSubmit =  (event) => {
    event.preventDefault();
    if (!username || !password) {
      setIsModalOpen(true);
      return;
    }
    const formData = {
      username,
      password
    };
    const apiEndpoint = isLogin ? 'login' : 'register';
    try {
      socket.addEventListener('open', (event) => {
      });
      socket.send(JSON.stringify({
        type: apiEndpoint,
        formData: formData
      }));
    } catch (error) {
      console.log(error);
    }
    socket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'loginResponse') {
        const { success, token, user } = data;
        if (success) {
          sessionStorage.setItem('token', token);
          sessionStorage.setItem('user', JSON.stringify(user));
          navigate('/');
        } else {
          console.log('login err');
        }
      }
      if (data.type === 'registerResponse') {
        const { success } = data;
        if (success) {
          setIsLogin(!isLogin);
        }
        else {
          console.log('reg err');
        }
      }
    });
  }

  const handleSwitch = () => {
    setIsLogin(!isLogin);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <h2 className="h2">{isLogin ? 'Login' : 'Register'}</h2>
        {isLogin ? (
          <LoginForm
            formData={{ username, password }}
            handleChange={(event) =>
              event.target.name === 'username'
                ? setUsername(event.target.value)
                : setPassword(event.target.value)
            }
            
            handleSwitchToRegister={handleSwitch}
          />
        ) : (
          <RegistrationForm
            formData={{ username, password }}
            handleChange={(event) =>
              event.target.name === 'username'
                ? setUsername(event.target.value)
                : setPassword(event.target.value)
            }
            
            handleSwitchToLogin={handleSwitch}
          />
        )}
      </div>
      <Modal isOpen={isModalOpen} onRequestClose={closeModal}>
        <h2>Please fill in all fields</h2>
        <button onClick={closeModal}>Close</button>
      </Modal>
    </form>
  );
};

export default AuthPage;