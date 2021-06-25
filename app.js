const bodyParser = require('body-parser')
const express = require('express')
const  mongoose = require('mongoose')
const passport = require('passport')
const passportLocalMongoose = require('passport-local-mongoose')
const session = require("express-session")

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.use(session({
    secret: 'Thisisasecret',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/loginDB",{useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false, useCreateIndex: true});

const userSchema = new mongoose.Schema({
    username : String,
    password : String
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("User", userSchema);
passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.get('/', (req, res) => {
    if(req.isAuthenticated()){
        res.send("<h1>secret</h1>");
    }
    else{
        res.redirect("/login");
    }
});

app.get("/signup", function(req, res){
    res.render("signup");
});

app.get("/login", function(req,res){
    res.render("login");
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
            res.redirect("/");
        }
    })
});

app.listen(port, () => console.log(`Example app listening on port port!`))