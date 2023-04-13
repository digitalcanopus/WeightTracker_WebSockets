const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const cookie = require('cookie');
const fs = require('fs');

const saltRounds = 10;

const app = express();
const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 3001 });

app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors());
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
      if (path.endsWith('.js')) {
        res.setHeader('Content-Type', 'text/javascript');
      }
    }
}));

const upload = multer({ storage: storage });

mongoose.connect('mongodb://127.0.0.1:27017/weight-tracker', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('MongoDB connected successfully');
    })
    .catch((err) => {
        console.log(err);
    });

const userSchema = new mongoose.Schema({
    username: String,
    password: String
});
const Users = mongoose.model('Users', userSchema);

const weightSchema = new mongoose.Schema({
    date: Date,
    weight: Number,
    files: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Users' }
});
const Weight = mongoose.model('Weight', weightSchema);

const fileSchema = new mongoose.Schema({
    file: String,
});
const File = mongoose.model('File', fileSchema);

const JWT_SECRET = 'hello123';

server.on('connection', (socket, req) => { 
  socket.on('message', async (message) => {   
    const data = JSON.parse(message);
    //get
    if (data.type === 'fetchWeights') {
      try {
        const cookies = data.cookie;
        if (cookies && cookies.token) {
          const decodedData = jwt.verify(cookies.token, JWT_SECRET);
        } else {
          console.log('no cookie');
          socket.send(JSON.stringify({
            type: 'authFirst',
          }));
          socket.close();
          return;
        }
      } catch (err) {
        console.log('no cookie');
        socket.send(JSON.stringify({
          type: 'authFirst',
          data: err.message
        }));
        socket.close();
        return;
      }
      try {
        const userId = data.cookie.user.id;
        const weights = await Weight.find({ user: userId }).populate('files').exec();
        socket.send(JSON.stringify({
          type: 'weights',
          data: weights
        }));
      } catch (err) {
        console.log(err);
        socket.send(JSON.stringify({
          type: 'error',
          data: err.message
        }));
      }
    }
    //login
    if (data.type === 'login') {
      console.log('login'); 
      const { username, password } = data.formData;
      if (!username || !password) {
        console.log('Invalid username or password');
        socket.send(JSON.stringify({
          type: 'loginResponse',
          success: false
        }));
        return;
      }
      try {
        const user = await Users.findOne({ username });
        if (!user || !bcrypt.compareSync(password, user.password)) {
          console.log('Invalid username or password');
          socket.send(JSON.stringify({
            type: 'loginResponse',
            success: false
          }));
          return;
        }
        const isMatch = bcrypt.compare(password, user.password);
        if (!isMatch) {
          console.log('Invalid username or password');
          socket.send(JSON.stringify({
            type: 'loginResponse',
            success: false
          }));
          return;
        }
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
        socket.send(JSON.stringify({
          type: 'loginResponse',
          success: true,
          token,
          user: {
            username: user.username,
            id: user._id
          },
        }));
      } catch (error) {
        console.log(error);
        socket.send(JSON.stringify({
          type: 'loginResponse',
          success: false
        }));
      }
    }
    //registration
    if (data.type === 'register') {
      console.log('register');
      const { username, password } = data.formData;
      if (!username || !password) {
        console.log('Invalid username or password');
        socket.send(JSON.stringify({
          type: 'registerResponse',
          success: false,
        }));
        return;
      }
      try {
        const existingUser = await Users.findOne({ username: username });
        if (existingUser) {
          socket.send({
            type: 'userExists'
          });
          return;
        }
        const salt = await bcrypt.genSalt(saltRounds);
        const hashedPassword = await bcrypt.hash(password, salt);  
        const newUser = new Users({
          username,
          password: hashedPassword,
        });
        newUser.save();
        socket.send(JSON.stringify({
          type: 'registerResponse',
          success: true,
        }));
      } catch (error) {
        console.log(error);
        socket.send(JSON.stringify({
          type: 'registerResponse',
          success: false
        }));
      }
    }
    //post
    if (data.type === 'addWeight') {
      console.log('addWeight');
      const userId = data.cookie.user.id;
      const weight = new Weight({
        date: data.data.date,
        weight: data.data.weight,
        user: userId,
        files: []
      });
      const req = {
        headers: { 'Content-Type': 'multipart/form-data' }, 
        body: null, 
      };
      try {
        const files = [];
        if (data.files && data.files.length > 0) {
          for (let i = 0; i < data.files.length; i++) {
            const base64Data = data.files[i];
            const binaryData = Buffer.from(base64Data, 'base64');
            const filePath = path.join('./uploads', data.fileNames[i]);
            fs.writeFile(filePath, binaryData, (err) => {
              if (err) {
                console.error(err);
              } else {
                console.log(`Файл ${data.fileNames[i]} успешно сохранен на сервере`);
              }
            });

            const newFile = new File({
              file: data.fileNames[i]
            });
            
            files.push(newFile);
            await newFile.save();
          }
        }
        weight.files = files.map(file => file._id);
        const newWeight = await weight.save();
        console.log('weight saved');
        socket.send(JSON.stringify({
          type: 'added',
          data: {
            ...newWeight,
            files: newWeight.files.map(file => file.file) 
          }
        }));
      } catch (err) {
        console.log(err);
        socket.send(JSON.stringify({
          type: 'addErr'
        }));
      }
    }
    //put record
    if (data.type === 'editRecord') {
      console.log('got edit rec');
      const id = data.id;
      const userId = data.cookie.user.id;
      const updatedWeight = {
        date: data.record.date,
        weight: data.record.weight,
        user: userId
      };
      Weight.findByIdAndUpdate(data.id, updatedWeight, { new: true })
        .then(weight => {
          if (!weight) {
            socket.send(JSON.stringify({
              type: 'wnf'
            }));
          } else {
            socket.send(JSON.stringify({
              type: 'edited',
              data: weight,
              id: id
            }));
          }
        })
        .catch(err => {
          console.log(err);
          socket.send(JSON.stringify({
            type: 'editErr'
          }));
        });
    }
    //delete record 
    if (data.type === 'deleteRecord') {
      console.log('got del rec');
      const id = data.id;
      Weight.findByIdAndDelete(id)
        .then(weight => {
          if (!weight) {
            socket.send(JSON.stringify({
              type: 'rnf'
            }));
          } else {
            File.deleteMany({ _id: { $in: weight.files } })
              .then(() => {
                socket.send(JSON.stringify({
                  type: 'delRecOk',
                  id: id
                }));
              })
              .catch(err => {
                console.log(err);
                socket.send(JSON.stringify({
                  type: 'delFilesErr'
                }));
              });
          }
        })
        .catch(err => {
          console.log(err);
          socket.send(JSON.stringify({
            type: 'delRecErr'
          }));
        });
    }
    //delete file
    if (data.type === 'deleteFile') {
      console.log('got del file');
      const id = data.id;
      const userId = data.cookie.user.id;
      File.findByIdAndDelete(id)
        .then(file => {
          if (!file) {
            socket.send(JSON.stringify({
              type: 'fnf'
            }));
          } else {
            Weight.findOne({ user: userId, files: id })
              .then(weight => {
                if (!weight) {
                  console.log('Weight not found');
                  socket.send(JSON.stringify({
                    type: 'wnf'
                  }));
                } else {
                  console.log('Weight updated successfully');
                  socket.send(JSON.stringify({
                    type: 'delFileOk',
                    id: id
                  }));
                }
              })
              .catch(err => {
                console.log(err);
                socket.send(JSON.stringify({
                  type: 'delFileErr'
                }));
              });
          }
        })
        .catch(err => {
          console.log(err);
          socket.send(JSON.stringify({
            type: 'delFileErr'
          }));
        });
    }
    //exit
    if (data.type === 'exit') {
      console.log('exit');
      const user = null;
      const token = data.cookie.token;
      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
          console.log('err');
          socket.send(JSON.stringify({
            type: 'authFirst'
          }));
        } else {
          console.log('ok');
          const expiredToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, { expiresIn: 0 });
          socket.send(JSON.stringify({
            type: 'exitOk',
            token: expiredToken,
            user: user
          }));
        }
      });
    }
  }); 
  socket.on('close', () => {
    console.log('Клиентов нет');
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.use(express.static(path.join(__dirname, 'public'), { 'Content-Type': 'text/javascript' }));
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});