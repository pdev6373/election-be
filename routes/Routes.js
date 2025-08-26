const {Router} = require('express');
const { registerVoter, loginVoter, getElectionVoters, getVoter } = require('../controllers/voterController');
const { addElection, getElections, getElection, removeElection, updateElection, getCandidatesOfElection } = require('../controllers/electionsController');
const { addCandidate, getCandidate, removeCandidate, voteCandidate } = require('../controllers/candidateController');
const authMiddleware = require('../middleware/authMiddleware');

const router = Router();

router.post('/voters/register', registerVoter)
router.post('/voters/login', loginVoter)
router.get('/voters/:id', authMiddleware, getVoter)
router.get('/elections/:id/voters', authMiddleware, getElectionVoters)



router.post('/elections', authMiddleware, addElection)
router.get('/elections', authMiddleware, getElections)
router.get('/elections/:id', authMiddleware, getElection)
router.delete('/elections/:id', authMiddleware, removeElection)
router.patch('/elections/:id', authMiddleware, updateElection)
router.get('/elections/:id/candidates', authMiddleware, getCandidatesOfElection)



router.post('/candidates', authMiddleware, addCandidate)
router.get('/candidates/:id', authMiddleware, getCandidate)
router.delete('/candidates/:id', authMiddleware, removeCandidate)
router.patch('/candidates/:id', authMiddleware, voteCandidate)




module.exports = router;