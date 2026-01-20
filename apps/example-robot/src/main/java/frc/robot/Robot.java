package frc.robot;

import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.networktables.*;
import edu.wpi.first.wpilibj.TimedRobot;

/**
 * The methods in this class are called automatically corresponding to each mode, as described in
 * the TimedRobot documentation. If you change the name of this class or the package after creating
 * this project, you must also update the Main.java file in the project.
 */
public class Robot extends TimedRobot {
  private static final String kDefaultAuto = "Default";
  private static final String kCustomAuto = "My Auto";
  private String m_autoSelected;
  private static final NetworkTableInstance nt = NetworkTableInstance.getDefault();

  private DoublePublisher m_xPub;
  private DoublePublisher m_yPub;
  private DoublePublisher m_zPub;
  private DoublePublisher m_gyroPub;
  private StringSubscriber m_autoSub;

  /**
   * This function is run when the robot is first started up and should be used for any
   * initialization code.
   */
  public Robot() {
    // AutoMode string topic
    m_autoSub = nt.getStringTopic("/MyTable/AutoMode").subscribe(kDefaultAuto);

    // Accelerometer values
    m_xPub = nt.getDoubleTopic("/MyTable/Accelerometer/X").publish();
    m_yPub = nt.getDoubleTopic("/MyTable/Accelerometer/Y").publish();
    m_zPub = nt.getDoubleTopic("/MyTable/Accelerometer/Z").publish();

    var posePublisher = nt.getProtobufTopic("/MyTable/Pose", Pose2d.proto).publish();
    posePublisher.set(new Pose2d(1, 2, new Rotation2d(Math.PI)));

    m_gyroPub = nt.getDoubleTopic("/MyTable/Gyro").publish();
  }

  /**
   * This function is called every 20 ms, no matter the mode. Use this for items like diagnostics
   * that you want ran during disabled, autonomous, teleoperated and test.
   *
   * <p>This runs after the mode specific periodic functions, but before LiveWindow and
   * SmartDashboard integrated updating.
   */
  @Override
  public void robotPeriodic() {
    // Gyro value
    m_gyroPub.set(1.234);

    // Accelerometer values
    m_xPub.set(1.4);
    m_yPub.set(2.5);
    m_zPub.set(3.6);
  }

  /**
   * This autonomous (along with the chooser code above) shows how to select between different
   * autonomous modes using the dashboard. The sendable chooser code works with the Java
   * SmartDashboard. If you prefer the LabVIEW Dashboard, remove all of the chooser code and
   * uncomment the getString line to get the auto name from the text box below the Gyro
   *
   * <p>You can add additional auto modes by adding additional comparisons to the switch structure
   * below with additional strings. If using the SendableChooser make sure to add them to the
   * chooser code above as well.
   */
  @Override
  public void autonomousInit() {
    m_autoSelected = m_autoSub.get();
    System.out.println("Auto selected: " + m_autoSub.get());
  }

  /** This function is called periodically during autonomous. */
  @Override
  public void autonomousPeriodic() {
    switch (m_autoSelected) {
      case kCustomAuto:
        // Put custom auto code here
        break;
      case kDefaultAuto:
      default:
        // Put default auto code here
        break;
    }
  }

  /** This function is called once when teleop is enabled. */
  @Override
  public void teleopInit() {
  }

  /** This function is called periodically during operator control. */
  @Override
  public void teleopPeriodic() {
  }

  /** This function is called once when the robot is disabled. */
  @Override
  public void disabledInit() {
  }

  /** This function is called periodically when disabled. */
  @Override
  public void disabledPeriodic() {
  }

  /** This function is called once when test mode is enabled. */
  @Override
  public void testInit() {
  }

  /** This function is called periodically during test mode. */
  @Override
  public void testPeriodic() {
  }

  /** This function is called once when the robot is first started up. */
  @Override
  public void simulationInit() {
  }

  /** This function is called periodically whilst in simulation. */
  @Override
  public void simulationPeriodic() {
  }
}
