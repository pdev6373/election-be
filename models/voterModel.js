const { Schema, model, Types } = require('mongoose');

const voterSchema = new Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    votedElections: [{ type: Types.ObjectId, required: true, ref: 'Election' }],
    isAdmin: { type: Boolean, default: false },

    // NEW FIELD FOR BLOCKCHAIN INTEGRATION
    blockchainVotes: [
      {
        electionId: { type: Types.ObjectId, ref: 'Election', required: true },
        candidateId: { type: Types.ObjectId, ref: 'Candidate', required: true },
        transactionHash: { type: String, required: true, index: true },
        blockNumber: { type: Number },
        voterHash: { type: String, required: true }, // Privacy-preserving hash
        gasUsed: { type: Number }, // Optional: track gas costs
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

module.exports = model('Voter', voterSchema);
