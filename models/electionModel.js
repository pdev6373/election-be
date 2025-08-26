const { Schema, model, Types } = require('mongoose');

const electionSchema = new Schema(
  {
    title: { type: String, required: true },
    thumbnail: { type: String, required: true },
    description: { type: String, required: true },
    candidates: [{ type: Types.ObjectId, required: true, ref: 'Candidate' }],
    voters: [{ type: Types.ObjectId, required: true, ref: 'Voter' }],

    // NEW FIELDS FOR BLOCKCHAIN INTEGRATION (OPTIONAL)
    totalBlockchainTxs: { type: Number, default: 0 }, // Total blockchain transactions
    lastBlockchainSync: { type: Date }, // When last synced with blockchain
    blockchainEnabled: { type: Boolean, default: true }, // Feature toggle
  },
  { timestamps: true },
);

module.exports = model('Election', electionSchema);
