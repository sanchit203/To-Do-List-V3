require('dotenv').config();
const bodyParser = require('body-parser');
const express = require('express');
const  mongoose = require('mongoose');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const session = require("express-session");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const FacebookStrategy = require('passport-facebook').Strategy;
const fs = require('fs');
const key = fs.readFileSync(__dirname+'/localhost-key.pem');
const cert = fs.readFileSync(__dirname+'/localhost.pem');
const https = require('https');
const lodash = require("lodash");

const app = express();
const port = 3000;
const server = https.createServer({ key, cert }, app);

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname+"/public"));

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(require('flash')());

mongoose.connect("mongodb://localhost:27017/loginDB",{useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false, useCreateIndex: true});

const itemSchema = {
  userId : String,
  name : String
}

const Item = mongoose.model("Item", itemSchema);

const listSchema = {
  userId : String,
  name : String,
  title : String
}

const List =mongoose.model("List", listSchema);

const userSchema = new mongoose.Schema({
    username : String,
    password : String,
    googleId : String,
    facebookId : String,
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);
passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  })

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "https://localhost:3000/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.APP_ID,
    clientSecret: process.env.APP_SECRET,
    callbackURL: "https://localhost:3000/auth/facebook/secrets",
    profileFields: ['id', 'email']
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get('/', (req, res) => {
    if(req.isAuthenticated())
    {
      const loggedUser = req.user;
      Item.find({userId : loggedUser._id}, function(err, founditems){
        if(founditems.length==0)
        {
          const item1 = new Item({
            userId : loggedUser._id,
            name : "Welecome to your todolist!"
          });
          
          const item2 = new Item({
            userId : loggedUser._id,
            name : "Hit the + button to add a new item."
          })
          
          const item3 = new Item({
            userId : loggedUser._id,
            name : "<--Hit this to delete an item."
          });

          const defaultItems = [item1, item2, item3];
          Item.insertMany(defaultItems, function(err){
            if(err){
              log(err);
            }
            res.redirect("/");
          })
        }
        else{
          res.render("list", {listTitle : "Today", items : founditems});
        }
      })
    }
    else{
        res.redirect("/signup");
    }
});

app.get("/lists/:topic", function(req,res){
  if(req.isAuthenticated()){
    const loggedUser= req.user;
    const requestedList = lodash.lowerCase(req.params.topic);
    if(requestedList=== "Today")
    {
      res.redirect("/");
    }
    else{
      List.find({title : requestedList, userId: req.user._id}, function(err, listItems){
        if(!err)
        {
          if(listItems.length===0){
            const item1 = new List({
              userId : loggedUser._id,
              name : "Welecome to your todolist!",
              title : requestedList
            });

            const item2 = new List({
              userId : loggedUser._id,
              name : "Hit the + button to add a new item.",
              title : requestedList
            })

            const item3 = new List({
              userId : loggedUser._id,
              name : "<--Hit this to delete an item.",
              title : requestedList
            });

            const defaultItems = [item1, item2, item3];

            List.insertMany(defaultItems, function(err){
              if(err){
                console.log(err);
              }
              res.redirect("/lists/"+req.params.topic);
            })
          }
          else{
            res.render("list", {listTitle : lodash.upperCase(requestedList), items : listItems});
          }
        }
        else{
          console.log(err);
          res.redirect("/");
        }
      })
    }
  }
  else{
    res.redirect("/singup");
  }
})

app.get("/logout", (req,res) => {
  req.logout();
  res.redirect('/login');
})

app.get("/signup", function(req, res){
    res.render("signup");
});

app.get("/signup/email", function(req,res){
  res.render("signup_email");
})

app.get("/login", function(req,res){
    res.render("login");
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
});

app.get('/auth/facebook',
  passport.authenticate('facebook'));

app.get('/auth/facebook/secrets',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
});

app.post("/", function(req, res){
  const loggedUser = req.user;
  const requestedList = lodash.lowerCase(req.body.list);
  if(requestedList==="today")
  {
    const newItem = new Item({
      userId : loggedUser._id,
      name: req.body.todoitem
    });
    newItem.save(function(err){
      if(err){
        console.log(err);
      }
      res.redirect("/");
    });
  }
  else{
    const newItem = new List({
      userId : loggedUser._id,
      name : req.body.todoitem,
      title : requestedList
    });
    newItem.save(function(err){
      if(err){
        console.log(err);
      }
      res.redirect("/lists/"+lodash.kebabCase(requestedList));
    });
  }
});

app.post("/delete", function(req, res){
  const itemId = req.body.deleteItem;
  const requestedList = lodash.lowerCase(req.body.listTitle);
  if(requestedList==="today"){
    Item.findByIdAndDelete(itemId, function(err){
      if(err){
        console.log(err);
      }
      res.redirect("/");
    })
  }
  else{
    List.findByIdAndDelete(itemId, function(err){
      if(err){
        console.log(err);
      }
      res.redirect("/lists/"+lodash.kebabCase(requestedList));
    })
  }
});

app.post("/signup", function(req,res){
    User.register({username : req.body.username}, req.body.password, function(err, user){
        if(err){
            console.log(err);
            res.redirect("/signup");
        }
        else{
            passport.authenticate("local")(req, res, function(){
                res.redirect("/");
            })
        }
    })
});

app.post("/login", function(req, res){
    const user = new User({
        username : req.body.username,
        password : req.body.password
    });
    req.login(user, function(err){
        if(err){
            console.log(err);
            res.redirect("/login");
        }
        else{
            passport.authenticate("local")(req, res, function(){
              res.redirect("/");
            });
        }
    })
});

server.listen(port, () => {
  console.log(`Server is listening on https://localhost:${port}`);
});