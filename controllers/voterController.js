const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Voter = require('../models/voterModel');
const ElectionModel = require('../models/electionModel');
const HttpError = require('../models/errorModel');

//============================== REGISTER A NEW VOTER
// POST : api/voters/register
// UNPROTECTED
const registerVoter = async (req, res, next) => {
  try {
    const { fullName, email, password, password2 } = req.body;
    if (!fullName || !email || !password || !password2) {
      return next(new HttpError('Fill in all fields.', 422));
    }

    // make all emails lowercased
    const newEmail = email.toLowerCase();
    // check if the email already exists in db
    const emailExists = await Voter.findOne({ email: newEmail });
    if (emailExists) {
      return next(new HttpError('Email already exist.', 422));
    }
    // make sure password is 6+ characters
    if (password.trim().length < 6) {
      return next(
        new HttpError('Password should be at least 6 characters.', 422),
      );
    }
    // make sure passwords match
    if (password != password2) {
      return next(new HttpError('Passwords do not match.', 422));
    }
    // No user/voter should be admin except one with email of "admin@gmail.com"
    let isAdmin = false;
    if (newEmail == 'admin@gmail.com') {
      isAdmin = true;
    }
    // hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    // save new voter in db
    const newVoter = await Voter.create({
      fullName,
      email: newEmail,
      password: hashedPassword,
      isAdmin,
    });
    res.status(201).json(`New voter ${newVoter.email} created.`);
  } catch (error) {
    return next(new HttpError('Voter registration failed.', 422));
  }
};

// JWT generator for login
const generateToken = (payload) => {
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
  return token;
};

//============================== LOGIN VOTER
// POST : api/voters/login
// UNPROTECTED
const loginVoter = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new HttpError('Fill in all fields.', 422));
    }

    const newEmail = email.toLowerCase();

    const voter = await Voter.findOne({ email: newEmail });
    if (!voter) {
      return next(new HttpError('Invalid Credentials.', 422));
    }

    // make sure u await the compare else it'll always match
    const comparePass = await bcrypt.compare(password, voter.password);
    if (!comparePass) {
      return next(new HttpError('Invalid credentials.', 422));
    }

    const { _id: id, isAdmin } = voter;
    const token = generateToken({ id, isAdmin });

    res.json({
      token,
      id,
      votedElections: voter.votedElections,
      isAdmin: voter.isAdmin,
    });
  } catch (error) {
    return next(
      new HttpError('Login failed. Please check your credentials.', 422),
    );
  }
};

//============================== LOGOUT VOTER
// api/voters/logout
// UNPROTECTED
// const logoutVoter = (req, res, next) => {
//     res.status(200).json('Voter Logged out')
// }

//============================== GET VOTERS OF AN ELECTION
// api/elections/:id/voters
// PROTECTED
const getElectionVoters = async (req, res, next) => {
  const { id } = req.params;
  try {
    const response = await ElectionModel.findById(id).populate('voters');
    res.json(response.voters);
  } catch (error) {
    return next(new HttpError("Couldn't get voters", 400));
  }
};

//============================== GET VOTER
// api/voters/:id
// PROTECTED
const getVoter = async (req, res, next) => {
  const { id } = req.params;
  try {
    const voter = await Voter.findById(id).select('-password');
    res.json(voter);
  } catch (error) {
    return next(HttpError("Couldn't get voter"));
  }
};

module.exports = { registerVoter, loginVoter, getElectionVoters, getVoter };
