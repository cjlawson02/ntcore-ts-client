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
  private DoublePublisher m_gyroPub;
  private StringSubscriber m_autoSub;
  private ProtobufPublisher<Pose2d> m_posePub;
  private StructPublisher<Pose2d> m_poseStructPub;
  /** Subscribes to client-published struct, echoes to PoseStructEcho for E2E verification. */
  private StructSubscriber<Pose2d> m_poseStructFromClientSub;
  private StructPublisher<Pose2d> m_poseStructEchoPub;
  private double m_demoTime = 0;
  private static final double kDemoFigure8ScaleX = 1.8;
  private static final double kDemoFigure8ScaleY = 1.2;
  /** Y offset so path sits higher on pose grid (+Y = up on grid). */
  private static final double kDemoPoseOffsetY = 1.5;
  private static final double kDemoFigure8PeriodSec = 10.0;

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

    m_posePub = nt.getProtobufTopic("/MyTable/Pose", Pose2d.proto).publish();
    m_posePub.set(new Pose2d(0, 0, new Rotation2d(0)));

    m_poseStructPub = nt.getStructTopic("/MyTable/PoseStruct", Pose2d.struct).publish();
    m_poseStructPub.set(new Pose2d(0, 0, new Rotation2d(0)));

    // Subscribe to client-published struct topic and echo to PoseStructEcho for E2E verification
    m_poseStructFromClientSub =
        nt.getStructTopic("/MyTable/PoseStructFromClient", Pose2d.struct)
            .subscribe(new Pose2d(0, 0, new Rotation2d(0)));
    m_poseStructEchoPub = nt.getStructTopic("/MyTable/PoseStructEcho", Pose2d.struct).publish();

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
    // Echo client-published struct values to PoseStructEcho for E2E verification
    for (Pose2d received : m_poseStructFromClientSub.readQueueValues()) {
      m_poseStructEchoPub.set(received);
    }
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
    m_gyroPub.set(0);
    m_xPub.set(0);
    m_yPub.set(0);
    m_posePub.set(new Pose2d(0, 0, new Rotation2d(0)));
    m_poseStructPub.set(new Pose2d(0, 0, new Rotation2d(0)));
  }

  /** This function is called periodically when disabled. */
  @Override
  public void disabledPeriodic() {
  }

  /** This function is called once when test mode is enabled. */
  @Override
  public void testInit() {
    m_demoTime = 0;
  }

  /** This function is called periodically during test mode. */
  @Override
  public void testPeriodic() {
    m_demoTime += getPeriod();
    double t = m_demoTime;
    double omega = 2 * Math.PI / kDemoFigure8PeriodSec;

    // Pose: figure-8 (Lissajous) with Y offset so path sits higher on pose grid
    double x = kDemoFigure8ScaleX * Math.sin(omega * t);
    double y = kDemoPoseOffsetY + kDemoFigure8ScaleY * Math.sin(2 * omega * t);
    double vx = kDemoFigure8ScaleX * omega * Math.cos(omega * t);
    double vy = kDemoFigure8ScaleY * 2 * omega * Math.cos(2 * omega * t);
    double axWorld = -kDemoFigure8ScaleX * omega * omega * Math.sin(omega * t);
    double ayWorld = -kDemoFigure8ScaleY * 4 * omega * omega * Math.sin(2 * omega * t);

    double thetaRad = Math.atan2(vy, vx);
    Pose2d pose = new Pose2d(x, y, new Rotation2d(thetaRad));
    m_posePub.set(pose);
    m_poseStructPub.set(pose);

    // Gyro: match heading in degrees (CCW positive)
    m_gyroPub.set(Math.toDegrees(thetaRad));

    // Accelerometer values (X, Y in robot frame)
    double cosT = Math.cos(thetaRad);
    double sinT = Math.sin(thetaRad);
    double axRobot = (axWorld * cosT + ayWorld * sinT) / 9.81;
    double ayRobot = (-axWorld * sinT + ayWorld * cosT) / 9.81;
    m_xPub.set(axRobot);
    m_yPub.set(ayRobot);
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
