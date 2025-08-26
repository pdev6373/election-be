const { Schema, model, Types } = require('mongoose');

const Candidate = new Schema(
  {
    fullName: { type: String, required: true },
    image: { type: String, required: true },
    voteCount: { type: Number, default: 0 },
    motto: { type: String, required: true },
    election: { type: Types.ObjectId, required: true, ref: 'Election' },

    blockchainTxHashes: [
      {
        type: String,
        index: true, // for faster queries
      },
    ],
  },
  { timestamps: true },
);

module.exports = model('Candidate', Candidate);
