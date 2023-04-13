import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AddRecordForm from './AddRecordForm';
import { useNavigate } from 'react-router-dom';

function HomePage() {
  const [records, setRecords] = useState([]);
  const [editIndex, setEditIndex] = useState(-1);
  const [editDateValue, setEditDateValue] = useState('');
  const [editWeightValue, setEditWeightValue] = useState('');

  const socket = new WebSocket('ws://localhost:3001');
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecords();
  }, []);

  socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    switch (data.type) {
      case 'weights':
        const records = data.data.map(record => {
          const files = record.files.map(file => ({
            id: file._id,
            file: file.file,
            url: `/uploads/${file.file}`
          }));
          return {
            id: record._id,
            date: record.date,
            weight: record.weight, 
            files
          };
        });
        setRecords(records);
        break;
      case 'error':
        console.error(data.data);
        break;
      case 'authFirst':
        navigate('/auth');
        break;
      case 'added':
        updRec();
        break;
      case 'addErr':
        console.error('add error');
        break;
      case 'edited':
        setRecords(prevRecords => { 
          const updatedRecords = prevRecords.map(record => {
            if (record._id === data.id) {
              return data.data;
            }
            return record;
          });
          return updatedRecords;
        });
        updRec();
        break;
      case 'editErr':
        console.error('edit error');
        break;
      case 'wnf':
        console.log('weight not found');
        break;
      case 'rnf':
        console.log('record not found');
        break;
      case 'delRecOk':
        console.log('OK'); 
        setRecords(prevRecords => prevRecords.filter(record => record._id !== data.id));
        updRec();
        break;
      case 'delFilesErr':
        console.log('delete files error');
        break;
      case 'delRecErr':
        console.log('del rec error');
        break;
      case 'delFileOk':
        setRecords(prevRecords => {
          const updatedRecords = prevRecords.map(record => {
            if (record._id === data.id) {
              return res.data;
            }
            return record;
          });
          return updatedRecords;
        });
        console.log('delFileOk');
        updRec();
      case 'delFileErr':
        console.log('del file error');
        break;
      case 'exitOk':
        console.log('exitOK');
        const token = data.token;
        const user = data.user;
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(user));
        navigate('/auth');
        break;
    }
  });

  const fetchRecords = () => {
    socket.addEventListener('open', (event) => {
      console.log('Connected to server');
      updRec();
    });   
  };

  const exit = () => {
    const user = JSON.parse(sessionStorage.getItem('user'));
    const token = sessionStorage.getItem('token');
    socket.send(JSON.stringify({
      type: 'exit',
      cookie: {
        user: user,
        token: token
      }
    }));
  }

  const addRecord = async (record) => {
    const weight = {
      date: '',
      weight: ''
    };
    const files = [];
    let i = 0;
    for (const [key, value] of record.entries()) {
      switch (key) {
        case 'date':
          weight.date = value;
          break;
        case 'weight':
          weight.weight = value;
          break;
        case 'file':
          files[i] = value;
          i++;
          break;
      }
    } 
    const fileNames = files.map(file => file.name);
    const filePromises = [];
    for (let i = 0; i < files.length; i++) {
      filePromises.push(fileToBase64(files[i]));
    }
    const user = JSON.parse(sessionStorage.getItem('user'));
    const token = sessionStorage.getItem('token');
    Promise.all(filePromises)
      .then(base64DataArray => {
        const dataToSend = {
          type: 'addWeight',
          cookie: {
            user: user,
            token: token,
          },
          data: weight,
          files: base64DataArray, 
          fileNames: fileNames,
        };
        socket.send(JSON.stringify(dataToSend));
      })
      .catch(error => {
        console.error('Ошибка преобразования файла в Base64:', error);
      });
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result.split(',')[1]); 
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const deleteRecord = id => {
    console.log(id);
    const user = JSON.parse(sessionStorage.getItem('user')); 
    const token = sessionStorage.getItem('token');
    socket.send(JSON.stringify({
      type: 'deleteRecord',
      cookie: {
        user: user,
        token: token
      },
      id: id
    })); 
  }

  const deleteFile = id => {
    const user = JSON.parse(sessionStorage.getItem('user')); 
    const token = sessionStorage.getItem('token');
    socket.send(JSON.stringify({
      type: 'deleteFile',
      cookie: {
        user: user,
        token: token
      },
      id: id
    })); 
  }

  const editRecord = (id, updatedRecord) => {
    const user = JSON.parse(sessionStorage.getItem('user')); 
    const token = sessionStorage.getItem('token');
    socket.send(JSON.stringify({
      type: 'editRecord',
      cookie: {
        user: user,
        token: token
      },
      id: id,
      record: updatedRecord
    }));  
  }

  const updRec = () => {
    const user = JSON.parse(sessionStorage.getItem('user')); 
    const token = sessionStorage.getItem('token');
    socket.send(JSON.stringify({
      type: 'fetchWeights',
      cookie: {
        user: user,
        token: token
      }
    }));
  }

  const handleTableClick = (event) => {
    const isInputCellClicked = event.target.closest(".input-cell");
    if (!isInputCellClicked) {
      setEditIndex(-1);
    }
  };

  const handleEditClick = (index, value_d, value_w) => {
    setEditIndex(index);
    setEditDateValue(value_d);
    setEditWeightValue(value_w);
  };

  const handleDateChange = (event) => {
    setEditDateValue(event.target.value);
  };

  const handleWeightChange = (event) => {
    setEditWeightValue(event.target.value);
  };

  const handleKeyPress = (event, index, field) => {
    if (event.key === 'Enter') {
      setEditIndex(-1);
      const id = records[index].id;
      if (field == 'weight') { 
        const updatedRecord = { weight: editWeightValue };
        editRecord(id, updatedRecord);
      }     
      else if (field == 'date') {
        const updatedRecord = { date: editDateValue };
        editRecord(id, updatedRecord);
      }       
    }
  };

 const handleBlurWeight = (index) => {
    setEditIndex(-1);
    const id = records[index].id;
    const updatedRecord = { weight: editWeightValue };
    editRecord(id, updatedRecord);
  };

  const handleBlurDate = (index) => {
    setEditIndex(-1);
    const id = records[index].id;
    const updatedRecord = { date: editDateValue };
    editRecord(id, updatedRecord);
  };

  return (
    <div className="page">
      <div className="ext-btn">
      <button className="exit-btn btn btn-sm btn-outline-danger" onClick={exit}>Exit</button>
      </div>
      <AddRecordForm onAddRecord={addRecord} />
      <div className="table-cont">
      <h2 className="progr">Progress</h2>
      <table className="table" onClick={handleTableClick}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Weight (kg)</th>
            <th className="th-file">File</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(records) && records.map((record, index) => (
            <tr key={record._id}>
              
              <td style={{ width: '240px' }} className={`input-cell ${
                  editIndex === index ? "editing" : ""
                }`}
                onClick={() => handleEditClick(index, new Date(record.date).toISOString().substring(0, 10), record.weight)}
              >
              {editIndex === index ? (
                <input
                  type="date"
                  value={editDateValue}
                  onChange={handleDateChange}
                  onKeyPress={(event) => handleKeyPress(event, index, 'date')}
                  onBlur={() => handleBlurDate(index)}
                  style={{ width: '120px', height: '22px' }}
                />
              ) : (
                new Date(record.date).toLocaleDateString()
              )}
              </td>

              <td style={{ width: '240px' }} className={`input-cell ${
                  editIndex === index ? "editing" : ""
                }`}
                onClick={() => handleEditClick(index, new Date(record.date).toISOString().substring(0, 10), record.weight)}
              >
              {editIndex === index ? (
                <input
                  type="number"
                  value={editWeightValue}
                  onChange={handleWeightChange}
                  onKeyPress={(event) => handleKeyPress(event, index, 'weight')}
                  onBlur={() => handleBlurWeight(index)}
                  style={{ width: '40px', height: '22px' }}
                />
              ) : (
                record.weight
              )}
              </td>

              <td className="file-cell">
                {record.files && record.files.length > 0 ? (
                  record.files.map((file) => (
                    <div key={file._id}>
                    <a href={`../../uploads/${file.file}`} target="_blank" type="application/octet-stream" style={{ paddingRight: '8px' }}>
                    {file.file}
                    </a>
                  <button className="del-f-btn btn btn-sm btn-outline-danger" onClick={() => deleteFile(file.id)}>-</button>
                  </div>
                  ))
                ) : (
                  'No file'
                )}
              </td>

              <td>
                <button className="del-btn btn btn-sm btn-outline-danger" onClick={() => deleteRecord(record.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

export default HomePage;