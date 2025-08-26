const { v4: uuid } = require('uuid');
const cloudinary = require('../utils/cloudinary');
const HttpError = require('../models/errorModel');
const fs = require('fs');
const path = require('path');
const ElectionModel = require('../models/electionModel');
const mongoose = require('mongoose');
const CandidateModel = require('../models/CandidateModel');
const voterModel = require('../models/voterModel');

//============================== ADD NEW ELECTION
// POST : api/elections
// PROTECTED (only admin)
const addElection = async (req, res, next) => {
  try {
    // only admins can add election
    if (!req.user.isAdmin) {
      return next(
        new HttpError('Only admins are allowed to perform this action.'),
        403,
      );
    }

    const { title, description } = req.body;
    if (!title || !description) {
      return next(new HttpError('Please fill all fields', 422));
    }

    if (!req.files.thumbnail) {
      return next(new HttpError('Please choose an image', 422));
    }

    const { thumbnail } = req.files;
    // check file size
    if (thumbnail.size > 1000000) {
      return next(
        new HttpError('Profile picture too big. Should be less than 500kb'),
      );
    }

    let fileName = thumbnail.name;
    fileName = fileName.split('.');
    fileName = fileName[0] + uuid() + '.' + fileName[fileName.length - 1];
    await thumbnail.mv(
      path.join(__dirname, '..', 'uploads', fileName),
      async (err) => {
        if (err) {
          return next(new HttpError(err));
        }
        // store image on cloudinary
        const result = await cloudinary.uploader.upload(
          path.join(__dirname, '..', 'uploads', fileName),
          { resource_type: 'image' },
        );
        if (!result.secure_url) {
          return next(
            new HttpError("Couldn't upload image to the cloud.", 422),
          );
        }
        // save election to db
        const newElection = await ElectionModel.create({
          title,
          description,
          thumbnail: result.secure_url,
          candidates: [],
        });
        res.json(newElection);
      },
    );
  } catch (err) {
    return next(new HttpError(err));
  }
};

//============================== FETCH ALL ELECTIONS
// GET : api/elections
// PROTECTED
const getElections = async (req, res, next) => {
  try {
    const elections = await ElectionModel.find();
    res.status(200).json(elections);
  } catch (error) {
    return next(error);
  }
};

//============================== GET ELECTION CANDIDATES
// GET : api/elections/:id/candidates
// PROTECTED
const getCandidatesOfElection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const candidates = await CandidateModel.find({ election: id });
    res.json(candidates);
  } catch (error) {
    return next(error);
  }
};

//============================== GET ELECTION
// GET : api/elections/:id
// PROTECTED
const getElection = async (req, res) => {
  const { id } = req.params;
  try {
    const elections = await ElectionModel.findById(id);
    res.status(200).json(elections);
  } catch (error) {
    return res.json(error);
  }
};

//============================== DELETE ELECTION
// DELETE : api/elections/:id
// PROTECTED
const removeElection = async (req, res, next) => {
  try {
    // only admins can delete election
    if (!req.user.isAdmin) {
      return next(
        new HttpError('Only admins are allowed to perform this action.'),
        403,
      );
    }

    const { id } = req.params;

    const deletedElection = await ElectionModel.findByIdAndDelete(id);
    // delete candidates that belong to this election
    await CandidateModel.deleteMany({ election: id });
    res.json('Election deleted successfully');
  } catch (error) {
    return next(error);
  }
};

//============================== EDIT ELECTION
// PATCH : api/elections/:id
// PROTECTED
const updateElection = async (req, res) => {
  try {
    // only admins can edit election
    if (!req.user.isAdmin) {
      return next(
        new HttpError('Only admins are allowed to perform this action.'),
        403,
      );
    }

    const { id } = req.params;
    const { title, description } = req.body;

    if (!title || !description) {
      return next(new HttpError('Please fill all fields', 422));
    }

    if (req.files.thumbnail) {
      const { thumbnail } = req.files;
      // check file size
      if (thumbnail.size > 1000000) {
        return next(
          new HttpError('Profile picture too big. Should be less than 500kb'),
        );
      }

      let fileName = thumbnail.name;
      fileName = fileName.split('.');
      fileName = fileName[0] + uuid() + '.' + fileName[fileName.length - 1];
      thumbnail.mv(
        path.join(__dirname, '..', 'uploads', fileName),
        async (err) => {
          if (err) {
            return next(new HttpError(err));
          }
          // store image on cloudinary
          const result = await cloudinary.uploader.upload(
            path.join(__dirname, '..', 'uploads', fileName),
            { resource_type: 'image' },
          );
          // check if cloudinary storage was successful and save to db
          if (!result.secure_url) {
            return next(new HttpError("Image upload wasn't successful", 422));
          }

          // save election to db
          await ElectionModel.findByIdAndUpdate(id, {
            title,
            description,
            thumbnail: result.secure_url,
          });

          res.json('Election updated successfully', 200);
        },
      );
    }
  } catch (error) {
    return res.json(error);
  }
};

module.exports = {
  addElection,
  getElections,
  getElection,
  removeElection,
  updateElection,
  getCandidatesOfElection,
};
