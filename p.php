<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $name = $_POST['name'];
    $email = $_POST['email'];
    $message = $_POST['message'];
    // Use a service like SendGrid to send the email
    mail('haniifaahmad01@gmail.com', 'New Contact Form Submission', "Name: $name\nEmail: $email\nMessage: $message");
    header('Location: contact.html?success=1');
}
?>