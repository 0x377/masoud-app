import ExecutivePosition from '../../models/executive/ExecutivePosition.js';

class ExecutivePositionController {
  // Create position
  async createPosition(req, res) {
    try {
      const data = req.body;
      const userId = req.user.id;

      const positionModel = new ExecutivePosition();
      const position = await positionModel.createPosition(data, userId);

      res.status(201).json({
        success: true,
        message: 'Position created successfully',
        data: position
      });
    } catch (error) {
      console.error('Create position error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get available positions
  async getAvailablePositions(req, res) {
    try {
      const { department } = req.query;

      const positionModel = new ExecutivePosition();
      const positions = await positionModel.getAvailablePositions(department);

      res.json({
        success: true,
        data: positions
      });
    } catch (error) {
      console.error('Get available positions error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get position statistics
  async getPositionStatistics(req, res) {
    try {
      const positionModel = new ExecutivePosition();
      const statistics = await positionModel.getPositionStatistics();

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Get position statistics error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get predefined positions
  async getPredefinedPositions(req, res) {
    try {
      res.json({
        success: true,
        data: ExecutivePosition.POSITIONS
      });
    } catch (error) {
      console.error('Get predefined positions error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new ExecutivePositionController();
