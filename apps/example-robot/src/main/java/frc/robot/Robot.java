package frc.robot;

import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.networktables.*;
import edu.wpi.first.wpilibj.TimedRobot;

public class Robot extends TimedRobot {

  private static final NetworkTableInstance nt = NetworkTableInstance.getDefault();

  DoublePublisher xPub;
  DoublePublisher yPub;
  DoublePublisher zPub;
  DoublePublisher gyroPub;
  StringSubscriber autoSub;

  public Robot() {
    // AutoMode string topic
    autoSub = nt.getStringTopic("/MyTable/AutoMode").subscribe("not initialized");

    // Accelerometer values
    xPub = nt.getDoubleTopic("/MyTable/Accelerometer/X").publish();
    yPub = nt.getDoubleTopic("/MyTable/Accelerometer/Y").publish();
    zPub = nt.getDoubleTopic("/MyTable/Accelerometer/Z").publish();

    var posePublisher = nt.getProtobufTopic("/MyTable/Pose", Pose2d.proto).publish();
    posePublisher.set(new Pose2d(1, 2, new Rotation2d(Math.PI)));

    gyroPub = nt.getDoubleTopic("/MyTable/Gyro").publish();
  }

  @Override
  public void robotPeriodic() {
    // Gyro value
    gyroPub.set(1.234);

    // Accelerometer values
    xPub.set(1.4);
    yPub.set(2.5);
    zPub.set(3.6);

    // Read the AutoMode string from NetworkTables
    String autoMode = autoSub.get();
    System.out.println("Auto Mode: " + autoMode);
  }

  @Override
  public void autonomousInit() {
  }

  @Override
  public void autonomousPeriodic() {
  }

  @Override
  public void teleopInit() {
  }

  @Override
  public void teleopPeriodic() {
  }

  @Override
  public void disabledInit() {
  }

  @Override
  public void disabledPeriodic() {
  }

  @Override
  public void testInit() {
  }

  @Override
  public void testPeriodic() {
  }

  @Override
  public void simulationInit() {
  }

  @Override
  public void simulationPeriodic() {
  }
}
