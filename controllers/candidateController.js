const { v4: uuid } = require('uuid');
const { ethers } = require('ethers');
const Candidate = require('../models/CandidateModel');
const cloudinary = require('../utils/cloudinary');
const HttpError = require('../models/errorModel');
const path = require('path');
const { mongoose } = require('mongoose');
const ElectionModel = require('../models/electionModel');
const voterModel = require('../models/voterModel');

//============================== SIMPLE BLOCKCHAIN VOTE RECORDING
const recordVoteOnBlockchain = async (electionId, candidateId, voterHash) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
    const wallet = new ethers.Wallet(
      process.env.BLOCKCHAIN_PRIVATE_KEY,
      provider,
    );

    // Create vote data as hex
    const voteData = ethers.toUtf8Bytes(
      JSON.stringify({
        election: electionId,
        candidate: candidateId,
        voterHash: voterHash,
        timestamp: Date.now(),
      }),
    );

    // Send transaction with vote data
    const tx = await wallet.sendTransaction({
      to: wallet.address, // Send to self
      value: 0,
      data: ethers.hexlify(voteData),
    });

    return await tx.wait();
  } catch (error) {
    throw new Error(`Blockchain recording failed: ${error.message}`);
  }
};

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

    // Create privacy-preserving voter hash
    const voterHash = ethers.keccak256(
      ethers.toUtf8Bytes(`${currentVoterId}-${selectedElection}-${Date.now()}`),
    );

    // Record vote on blockchain
    const blockchainReceipt = await recordVoteOnBlockchain(
      selectedElection,
      candidateId,
      voterHash,
    );

    // Continue with existing database operations
    const candidate = await Candidate.findById(candidateId);
    const newVoteCount = candidate.voteCount + 1;

    const updatedCandidate = await Candidate.findByIdAndUpdate(
      candidateId,
      {
        voteCount: newVoteCount,
        $push: { blockchainTxHashes: blockchainReceipt.hash },
      },
      { new: true },
    );

    // Update relationships (existing code)
    const sess = await mongoose.startSession();
    sess.startTransaction();

    let voter = await voterModel.findById(currentVoterId);
    let election = await ElectionModel.findById(selectedElection);

    election.voters.push(voter);
    voter.votedElections.push(election);

    await election.save({ session: sess });
    await voter.save({ session: sess });
    await sess.commitTransaction();

    res.status(200).json({
      message: 'Vote casted and recorded on blockchain successfully',
      transactionHash: blockchainReceipt.hash,
      blockNumber: blockchainReceipt.blockNumber,
    });
  } catch (err) {
    return next(new HttpError(`Vote failed: ${err.message}`, 500));
  }
};

module.exports = { addCandidate, getCandidate, removeCandidate, voteCandidate };
