const { v4: uuid } = require('uuid');
const Candidate = require('../models/CandidateModel');
const cloudinary = require('../utils/cloudinary');
const HttpError = require('../models/errorModel');
const fs = require('fs');
const path = require('path');
const { mongoose } = require('mongoose');
const ElectionModel = require('../models/electionModel');
const voterModel = require('../models/voterModel');

//============================== ADD CANDIDATE
// POST : api/candidates
// PROTECTED (admin only)
const addCandidate = async (req, res, next) => {
  // only admins can edit election
  if (!req.user.isAdmin) {
    return next(
      new HttpError('Only admins are allowed to perform this action.'),
      403,
    );
  }

  try {
    const { fullName, motto, currentElection } = req.body;
    if (!fullName || !motto) {
      return next(new HttpError('Please fill all fields', 422));
    }

    if (!req.files.image) {
      return next(new HttpError('Please choose an image', 422));
    }

    const { image } = req.files;
    // check file size
    if (image.size > 1000000) {
      return next(
        new HttpError('FIle size too big. Should be less than 1mb'),
        422,
      );
    }

    let fileName = image.name;
    fileName = fileName.split('.');
    fileName = fileName[0] + uuid() + '.' + fileName[fileName.length - 1];
    image.mv(path.join(__dirname, '..', 'uploads', fileName), async (err) => {
      if (err) {
        return next(new HttpError(err));
      }
      // store image on cloudinary
      const result = await cloudinary.uploader
        .upload(path.join(__dirname, '..', 'uploads', fileName), {
          resource_type: 'image',
        })
        .catch((err) => {
          console.log(err);
        });
      if (!result.secure_url) {
        return next(new HttpError("Couldn't upload image to cloudinary"));
      }

      let newCandidate = await Candidate.create({
        fullName,
        motto,
        voters: 0,
        image: result.secure_url,
        election: currentElection,
      });

      // get election and add candidate to candidates document using sessions
      let election = await ElectionModel.findById(currentElection);

      const sess = await mongoose.startSession();
      sess.startTransaction();
      await newCandidate.save({ session: sess });
      election.candidates.push(newCandidate);
      await election.save({ session: sess });
      await sess.commitTransaction();

      // save candidate to db
      res.json('Candidate added successfully.', 201);
    });
  } catch (err) {
    return next(new HttpError(err));
  }
};

//============================== GET CANDIDATE
// PATCH : api/candidates/:id
// PROTECTED
const getCandidate = async (req, res) => {
  const { id } = req.params;

  try {
    const candidate = await Candidate.findById(id);
    return res.json(candidate);
  } catch (error) {
    return res.json(error);
  }
};

//============================== DELETE CANDIDATE
// DELETE : api/candidates/:id
// PROTECTED (admin only)
const removeCandidate = async (req, res, next) => {
  let currentCandidate;

  try {
    // only admins can edit election
    if (!req.user.isAdmin) {
      return next(
        new HttpError('Only admins are allowed to perform this action.'),
        403,
      );
    }

    const { id } = req.params;
    currentCandidate = await Candidate.findById(id).populate('election');
    if (!currentCandidate) {
      return next(new HttpError('Could not delete candidate', 404));
    } else {
      const sess = await mongoose.startSession();
      sess.startTransaction();
      await currentCandidate.deleteOne({ session: sess });
      currentCandidate.election.candidates.pull(currentCandidate);
      await currentCandidate.election.save({ session: sess });
      await sess.commitTransaction();
    }
    res.json('Candidate deleted successfully');
  } catch (err) {
    return next(new HttpError(err));
  }
};

//============================== VOTE CANDIDATE
// PATCH : api/candidates/:id
// PROTECTED
const voteCandidate = async (req, res, next) => {
  try {
    const { id: candidateId } = req.params;
    const { currentVoterId, selectedElection } = req.body;
    // get the candidate
    const candidate = await Candidate.findById(candidateId);
    const newVoteCount = candidate.voteCount + 1;
    // update candidate's votes
    const updatedCandidate = await Candidate.findByIdAndUpdate(
      candidateId,
      { voteCount: newVoteCount },
      { new: true },
    );
    // start session for relationship
    const sess = await mongoose.startSession();
    sess.startTransaction();
    // get the current voter
    let voter = await voterModel.findById(currentVoterId);
    await voter.save({ session: sess });
    // get selected election
    let election = await ElectionModel.findById(selectedElection);
    election.voters.push(voter);
    voter.votedElections.push(election);
    await election.save({ session: sess });
    await voter.save({ session: sess });
    await sess.commitTransaction();
    res.status(200).json('Vote casted successfully');
  } catch (err) {
    return next(new HttpError(err));
  }
};

module.exports = { addCandidate, getCandidate, removeCandidate, voteCandidate };
